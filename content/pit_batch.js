// content/pit_batch.js
(() => {
  if (window.__SUAP_EXT_PIT_BATCH__) return;
  window.__SUAP_EXT_PIT_BATCH__ = true;

  const { $, $$, norm, brToISO, makeBtn, setValueNoScroll, tempoToWidgetValue } = window.SUAP_EXT;

  const PIT_LS_QUEUE = "__SUAP_PIT_BATCH_QUEUE_PATHS__";
  const PIT_LS_ACTIVE = "__SUAP_PIT_BATCH_ACTIVE__";
  const PIT_LS_TOTAL = "__SUAP_PIT_BATCH_TOTAL__";
  const PIT_LS_SKIPPED = "__SUAP_PIT_BATCH_SKIPPED__";
  const PIT_LS_PANEL_POS = "__SUAP_PIT_BATCH_PANEL_POS__";
  const PIT_SS_LAST = "__SUAP_PIT_BATCH_LAST_SAVED_KEY__";
  const PIT_SS_LAST_TEMPO = "__SUAP_PIT_BATCH_LAST_TEMPO__";

  const pitGetQueue = () => { try { return JSON.parse(localStorage.getItem(PIT_LS_QUEUE) || "[]"); } catch { return []; } };
  const pitSetQueue = (q) => localStorage.setItem(PIT_LS_QUEUE, JSON.stringify(q || []));
  const pitIsActive = () => localStorage.getItem(PIT_LS_ACTIVE) === "1";
  const pitSetActive = (v) => localStorage.setItem(PIT_LS_ACTIVE, v ? "1" : "0");
  const pitSetTotal = (v) => localStorage.setItem(PIT_LS_TOTAL, String(v || 0));
  const pitGetTotal = () => Number(localStorage.getItem(PIT_LS_TOTAL) || "0");
  const pitSetSkipped = (v) => localStorage.setItem(PIT_LS_SKIPPED, String(v || 0));
  const pitGetSkipped = () => Number(localStorage.getItem(PIT_LS_SKIPPED) || "0");
  const pitIncSkipped = () => pitSetSkipped(pitGetSkipped() + 1);
  const pitSetPanelPos = (pos) => localStorage.setItem(PIT_LS_PANEL_POS, JSON.stringify(pos || null));
  const pitGetPanelPos = () => {
    try {
      const pos = JSON.parse(localStorage.getItem(PIT_LS_PANEL_POS) || "null");
      return pos && Number.isFinite(pos.top) && Number.isFinite(pos.left) ? pos : null;
    } catch {
      return null;
    }
  };

  function pitGetCadastroIds() {
    const m = location.pathname.match(/\/pgd2\/cadastrar_entrega_pit\/(\d+)\/(\d+)\/?$/i);
    return m ? { pitId: Number(m[1]), entregaId: Number(m[2]) } : null;
  }
  const isPitCadastro = () => !!pitGetCadastroIds();

  function isPitSelectPage() {
    if (!/\/pgd2\/selecionar_entrega_pes_cadastrar_entrega_pit\/\d+\/?$/i.test(location.pathname)) return false;
    return $$("a[href^='/pgd2/cadastrar_entrega_pit/']").some(a => /selecionar/i.test(norm(a.textContent)));
  }

  function pitClearBatch() {
    pitSetActive(false);
    pitSetQueue([]);
    pitSetTotal(0);
    pitSetSkipped(0);
    sessionStorage.removeItem(PIT_SS_LAST);
    document.getElementById("tm-pit-batch-stop-float")?.remove();
    document.getElementById("tm-pit-batch-panel")?.remove();
  }

  function pitEnsureStopFloat() {
    const shouldShow = pitIsActive() && isPitSelectPage();
    const existing = document.getElementById("tm-pit-batch-stop-float");
    if (!shouldShow) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const wrap = document.createElement("div");
    wrap.id = "tm-pit-batch-stop-float";
    wrap.className = "tm-ext-float-top-right";
    const stop = makeBtn("Parar lote", "danger");
    stop.id = "tm-pit-batch-stop";
    stop.addEventListener("click", () => {
      pitClearBatch();
      alert("Lote PIT interrompido.");
    });
    wrap.appendChild(stop);
    document.body.appendChild(wrap);
  }

  function pitCollectCadastroPathsFromSelectPage() {
    const paths = $$("a[href^='/pgd2/cadastrar_entrega_pit/']")
      .filter(a => /selecionar/i.test(norm(a.textContent)))
      .map(a => a.getAttribute("href") || "")
      .map(h => {
        const m = h.match(/\/pgd2\/cadastrar_entrega_pit\/(\d+)\/(\d+)\/?$/i);
        if (!m) return null;
        return `/pgd2/cadastrar_entrega_pit/${Number(m[1])}/${Number(m[2])}/`;
      })
      .filter(Boolean);
    return Array.from(new Set(paths));
  }

  function pitOpenNextFromQueue(reason = "") {
    if (window.__TM_PIT_BATCH_NAV__) return;
    const q = pitGetQueue();
    if (!q.length) {
      const skipped = pitGetSkipped();
      pitClearBatch();
      alert(skipped ? `Lote PIT concluído.\nEntregas puladas: ${skipped}.` : "Lote PIT concluído.");
      return;
    }
    const nextPath = q[0];
    const u = new URL(nextPath, location.origin);
    u.searchParams.set("__tm_pit_batch", "1");
    window.__TM_PIT_BATCH_NAV__ = true;
    console.log("[SUAP PIT] PrÃ³xima:", nextPath, reason ? `(${reason})` : "");
    location.href = u.toString();
  }

  function pitRemoveCurrentFromQueue(pitId, entregaId) {
    pitSetQueue(pitGetQueue().filter(p => !p.includes(`/cadastrar_entrega_pit/${pitId}/${entregaId}`)));
  }

  function pitCurrentCadastroPath() {
    const ids = pitGetCadastroIds();
    return ids ? `/pgd2/cadastrar_entrega_pit/${ids.pitId}/${ids.entregaId}/` : "";
  }

  function pitScheduleResumeIfActive(reason = "") {
    if (isPitSelectPage()) pitEnsureStopFloat();
    if (!pitIsActive()) return;
    const q = pitGetQueue();
    if (!q.length) return;
    if (window.__TM_PIT_BATCH_NAV__) return;
    const currentPath = pitCurrentCadastroPath();
    const nextPath = q[0];
    if (currentPath && nextPath && currentPath === nextPath) return;
    setTimeout(() => pitOpenNextFromQueue(reason), 900);
  }

  function pitGetTopHost() {
    const host = $(".title-container .action-bar-container");
    if (!host) return null;
    host.style.display = "flex";
    host.style.justifyContent = "flex-end";
    host.style.alignItems = "center";
    let bar = $(".action-bar", host);
    if (!bar) {
      bar = document.createElement("ul");
      bar.className = "action-bar tm-ext-actionbar-host";
      bar.style.display = "flex";
      bar.style.gap = "8px";
      bar.style.listStyle = "none";
      bar.style.margin = "0";
      bar.style.padding = "0";
      bar.style.alignItems = "center";
      host.appendChild(bar);
    } else {
      bar.classList.add("tm-ext-actionbar-host");
    }
    return bar;
  }

  function pitInjectButtonsOnSelectPage() {
    if (!isPitSelectPage()) return;
    if ($("#tm-pit-batch-start")) return;
    const bar = pitGetTopHost();
    if (!bar) return;
    const locked = !!window.SUAP_EXT?.lockedAccess; const start = makeBtn(locked ? "Comprar licença (trial expirado)" : "Preencher e salvar todas (lote)", locked ? "danger" : "success");
    start.id = "tm-pit-batch-start";
    start.addEventListener("click", () => { if (locked) { window.SUAP_EXT.openBuyPopup?.(); return; } const paths = pitCollectCadastroPathsFromSelectPage();
      if (!paths.length) { alert("NÃ£o encontrei links 'Selecionar' nesta pÃ¡gina."); return; }
      const total = paths.length;
      const msg = `Encontrei ${total} entrega(s). Iniciar preenchimento e salvar em lote?`;
      if (!confirm(msg)) return;
      if (total > 30 && !confirm(`SÃ£o ${total} entregas. Tem certeza que quer rodar o lote?`)) return;
      pitSetQueue(paths);
      pitSetTotal(total);
      pitSetSkipped(0);
      pitSetActive(true);
      console.info(`[SUAP PIT] Lote iniciado com ${total} entregas.`);
      sessionStorage.removeItem(PIT_SS_LAST);
      pitEnsureStopFloat();
      pitOpenNextFromQueue("start");
    });
    const li1 = document.createElement("li");
    li1.appendChild(start);
    bar.appendChild(li1);
    pitEnsureStopFloat();
  }

  function pitFindDlValueByLabel(labelRegex) {
    const nodes = $$("dl.secondary-info .list-item, dl.definition-list .list-item, .definition-list .list-item");
    for (const it of nodes) {
      const dt = it.querySelector("dt");
      const dd = it.querySelector("dd");
      if (!dt || !dd) continue;
      const k = norm(dt.textContent)
        .replace(/^[^a-z0-9]+/i, "")
        .replace(/\s*:\s*$/, "");
      const lbls = Array.isArray(labelRegex) ? labelRegex : [labelRegex];
      const matched = lbls.some(rx => (rx instanceof RegExp ? rx.test(k) : norm(k).toLowerCase() === norm(String(rx)).toLowerCase()));
      if (matched) return norm(dd.textContent);
    }
    return "";
  }

  function pitProgressText() {
    const q = pitGetQueue();
    const total = pitGetTotal() || q.length;
    const done = Math.max(0, total - q.length);
    // quando estamos na tela de cadastro e o lote estÃ¡ ativo, contamos a entrega atual como +1
    const current = (isPitCadastro() && pitIsActive()) ? 1 : 0;
    const shown = Math.min(total, done + current);
    return total ? `Progresso: ${shown}/${total}\n` : "";
  }

  function pitProgressState() {
    const q = pitGetQueue();
    const total = pitGetTotal() || q.length;
    const done = Math.max(0, total - q.length);
    const current = (isPitCadastro() && pitIsActive()) ? 1 : 0;
    return {
      total,
      shown: Math.min(total, done + current),
      skipped: pitGetSkipped()
    };
  }

  function pitGetPeriodEndBR() {
    const textSources = [document.title || "", $(".title-container h2")?.textContent || "", $(".title-container h3")?.textContent || ""];
    for (const txt of textSources) {
      const m = (txt || "").match(/PIT\s*-\s*(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
      if (m) return m[2];
    }
    return "";
  }

  function brEarliest(d1, d2) {
    const iso1 = brToISO(d1 || "");
    const iso2 = brToISO(d2 || "");
    if (iso1 && iso2) return (new Date(iso1) <= new Date(iso2)) ? d1 : d2;
    return d1 || d2 || "";
  }

  function pitExtractInfoFromCadastroPage() {
    const box = $(".general-box") || $(".content .general-box") || null;
    let titulo = "";
    const clean = (txt) => norm(txt).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const titleEl = box?.querySelector(".primary-info .title, h4.title, h3.title") || $(".primary-info .title, h4.title, h3.title");
    if (titleEl) {
      const clone = titleEl.cloneNode(true);
      clone.querySelectorAll("small").forEach(s => s.remove());
      titulo = norm(clone.textContent);
    }
    let descricao = "";
    const extra = box?.querySelector(".extra-info") || $(".extra-info");
    if (extra) {
      const nodes = Array.from(extra.children);
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.tagName === "H5" && /descricao/i.test(clean(node.textContent))) {
          const p = nodes[i + 1];
          if (p && p.tagName === "P") descricao = norm(p.innerText || p.textContent);
          break;
        }
      }
    }
    const prazoSecondary = pitFindDlValueByLabel([/^prazo$/i, /prazo/i, /prazo\s*final/i, /data\s*limite/i, /prazo\s*limite/i]);
    const prazoPitEnd = pitGetPeriodEndBR();
    const prazoBR = brEarliest(prazoSecondary, prazoPitEnd);
    return { titulo, descricao, prazoBR };
  }

  function pitRemovePanel() {
    document.getElementById("tm-pit-batch-panel")?.remove();
  }

  function pitClampPanelPos(panel, pos) {
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    return {
      left: Math.min(Math.max(margin, Number(pos?.left) || margin), maxLeft),
      top: Math.min(Math.max(margin, Number(pos?.top) || margin), maxTop)
    };
  }

  function pitApplyPanelPos(panel, pos) {
    const next = pitClampPanelPos(panel, pos);
    panel.style.left = `${next.left}px`;
    panel.style.top = `${next.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    return next;
  }

  function pitDefaultPanelPos(panel) {
    const rect = panel.getBoundingClientRect();
    return pitClampPanelPos(panel, {
      top: 16,
      left: Math.max(16, window.innerWidth - rect.width - 16)
    });
  }

  function pitEnablePanelDrag(panel, handle) {
    if (!panel || !handle) return;
    handle.style.cursor = "move";
    handle.style.userSelect = "none";

    handle.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();

      const startRect = panel.getBoundingClientRect();
      const startX = ev.clientX;
      const startY = ev.clientY;
      const prevUserSelect = document.body.style.userSelect;

      const onMove = (moveEv) => {
        const dx = moveEv.clientX - startX;
        const dy = moveEv.clientY - startY;
        pitApplyPanelPos(panel, {
          left: startRect.left + dx,
          top: startRect.top + dy
        });
      };

      const onUp = () => {
        document.body.style.userSelect = prevUserSelect;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const rect = panel.getBoundingClientRect();
        pitSetPanelPos({ left: rect.left, top: rect.top });
      };

      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  function pitAskTempoPlanejado(titulo, currentValue = "") {
    pitRemovePanel();
    const progress = pitProgressState();
    const defaultTempo =
      tempoToWidgetValue(currentValue) ||
      tempoToWidgetValue(sessionStorage.getItem(PIT_SS_LAST_TEMPO) || "") ||
      "1,00";

    return new Promise(resolve => {
      const panel = document.createElement("div");
      panel.id = "tm-pit-batch-panel";
      panel.className = "tm-ext-panel";

      const title = document.createElement("div");
      title.className = "tm-ext-panel-title";
      title.textContent = "Lote PIT";

      const meta = document.createElement("div");
      meta.className = "tm-ext-panel-meta";
      meta.textContent = progress.total
        ? `Progresso: ${progress.shown}/${progress.total} | Puladas: ${progress.skipped}`
        : `Puladas: ${progress.skipped}`;

      const label = document.createElement("label");
      label.className = "tm-ext-panel-label";
      label.textContent = "Entrega atual";

      const task = document.createElement("div");
      task.className = "tm-ext-panel-task";
      task.textContent = titulo || "Entrega sem título";

      const tempoLabel = document.createElement("label");
      tempoLabel.className = "tm-ext-panel-label";
      tempoLabel.textContent = "Tempo planejado";

      const input = document.createElement("input");
      input.className = "tm-ext-panel-input";
      input.type = "text";
      input.inputMode = "decimal";
      input.placeholder = "Ex.: 1,50";
      input.value = defaultTempo;

      const hint = document.createElement("div");
      hint.className = "tm-ext-panel-hint";
      hint.textContent = "Preencha o tempo e salve. Se esta entrega nao sera realizada neste mes, use Pular tarefa.";

      const error = document.createElement("div");
      error.className = "tm-ext-panel-error";

      const actions = document.createElement("div");
      actions.className = "tm-ext-panel-actions";

      const save = makeBtn("Salvar e continuar", "success");
      save.id = "tm-pit-panel-save";
      const skip = makeBtn("Pular tarefa", "danger");
      skip.id = "tm-pit-panel-skip";
      skip.style.background = "#6b7280";
      skip.style.borderColor = "#6b7280";
      const stop = makeBtn("Parar lote", "danger");
      stop.id = "tm-pit-panel-stop";

      function finish(result) {
        pitRemovePanel();
        resolve(result);
      }

      function showError(message) {
        error.textContent = message || "";
      }

      save.addEventListener("click", () => {
        const formatted = tempoToWidgetValue(input.value);
        const numeric = Number(String(formatted || "").replace(",", "."));
        if (!formatted) {
          showError("Informe um tempo valido para continuar.");
          input.focus();
          return;
        }
        if (!(numeric > 0)) {
          showError("Use 'Pular tarefa' para ignorar esta entrega neste mes.");
          input.focus();
          return;
        }
        sessionStorage.setItem(PIT_SS_LAST_TEMPO, formatted);
        finish({ action: "save", tempo: formatted });
      });

      skip.addEventListener("click", () => finish({ action: "skip" }));
      stop.addEventListener("click", () => finish({ action: "stop" }));

      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          save.click();
        }
        if (ev.key === "Escape") {
          ev.preventDefault();
          stop.click();
        }
      });

      actions.appendChild(save);
      actions.appendChild(skip);
      actions.appendChild(stop);

      panel.appendChild(title);
      panel.appendChild(meta);
      panel.appendChild(label);
      panel.appendChild(task);
      panel.appendChild(tempoLabel);
      panel.appendChild(input);
      panel.appendChild(hint);
      panel.appendChild(error);
      panel.appendChild(actions);

      document.body.appendChild(panel);
      pitEnablePanelDrag(panel, title);
      pitApplyPanelPos(panel, pitGetPanelPos() || pitDefaultPanelPos(panel));
      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    });
  }

  function pitIsCadastroReady() {
    return $("#planoindividualtrabalhoentregascadastrar_form") && $("#id_titulo") && $("#id_descricao") && $("#id_data_prazo") && $("#id_tempo_planejado");
  }

  function pitGetMissingRequiredFields() {
    const fields = [
      ["titulo", "#id_titulo"],
      ["descricao", "#id_descricao"],
      ["prazo", "#id_data_prazo"],
      ["tempo planejado", "#id_tempo_planejado"]
    ];
    return fields
      .filter(([, sel]) => !norm(document.querySelector(sel)?.value))
      .map(([label]) => label);
  }

  function pitRequiredOk() {
    return pitGetMissingRequiredFields().length === 0;
  }

  function pitWaitFor(condFn, timeoutMs = 15000) {
    return new Promise(resolve => {
      const start = Date.now();
      const step = () => {
        try { if (condFn()) return resolve(true); } catch {}
        if (Date.now() - start > timeoutMs) return resolve(false);
        requestAnimationFrame(step);
      };
      step();
    });
  }

  function pitClickSave() {
    const form = $("#planoindividualtrabalhoentregascadastrar_form");
    const btn = form?.querySelector("input[type='submit'][value='Salvar'], button[type='submit'], input[type='submit']");
    if (btn) btn.click();
    else form?.submit();
  }

  async function pitRunCadastroBatch() {
    if (!isPitCadastro()) return;
    pitEnsureStopFloat();
    if (!pitIsActive()) return;
    const params = new URLSearchParams(location.search);
    if (params.get("__tm_pit_batch") !== "1") return;
    if (window.__TM_PIT_BATCH_RAN__) return;
    window.__TM_PIT_BATCH_RAN__ = true;

    const ids = pitGetCadastroIds();
    if (!ids) return;

    const hasFormError = document.querySelector(".errornote") || document.querySelector("#planoindividualtrabalhoentregascadastrar_form .errorlist");
    if (hasFormError) {
      const skip = confirm("Houve erro ao salvar esta entrega.\n\nOK = pular e continuar\nCancelar = parar o lote");
      if (skip) {
        pitRemoveCurrentFromQueue(ids.pitId, ids.entregaId);
        pitOpenNextFromQueue("form-error-skip");
      } else {
        pitClearBatch();
        alert("Lote PIT interrompido.");
      }
      return;
    }

    const key = `${ids.pitId}:${ids.entregaId}`;
    const lastKey = sessionStorage.getItem(PIT_SS_LAST) || "";
    if (lastKey === key) {
      pitRemoveCurrentFromQueue(ids.pitId, ids.entregaId);
      pitOpenNextFromQueue("already-saved");
      return;
    }

    const ready = await pitWaitFor(pitIsCadastroReady, 15000);
    if (!ready) {
      alert("Timeout: a tela de cadastro do PIT nÃ£o carregou. Vou parar o lote PIT.");
      pitClearBatch();
      return;
    }

    const info = pitExtractInfoFromCadastroPage();

    const fTitulo = $("#id_titulo");
    const fDescricao = $("#id_descricao");
    const fPrazo = $("#id_data_prazo");
    const fTempo = $("#id_tempo_planejado");

    if (info.titulo) setValueNoScroll(fTitulo, info.titulo);
    if (info.descricao) setValueNoScroll(fDescricao, info.descricao);
    const prazoISO = brToISO(info.prazoBR);
    if (prazoISO) setValueNoScroll(fPrazo, prazoISO);

    const missingBeforeTempo = [
      !norm(fTitulo.value) ? "titulo" : "",
      !norm(fDescricao.value) ? "descricao" : "",
      !norm(fPrazo.value) ? "prazo" : ""
    ].filter(Boolean);
    if (missingBeforeTempo.length) {
      alert(`Nao consegui preencher automaticamente: ${missingBeforeTempo.join(", ")}.\nVou parar o lote PIT para evitar cadastro incompleto.`);
      pitClearBatch();
      return;
    }

    const tempoAtual = norm(fTempo.value);
    const precisaPerguntar = !tempoAtual || tempoAtual === "0,00" || tempoAtual === "0" || tempoAtual === "0,0";
    if (precisaPerguntar) {
      const choice = await pitAskTempoPlanejado(info.titulo, tempoAtual);
      if (!choice || choice.action === "stop") {
        pitClearBatch();
        alert("Lote PIT interrompido.");
        return;
      }
      if (choice.action === "skip") {
        pitIncSkipped();
        pitRemoveCurrentFromQueue(ids.pitId, ids.entregaId);
        pitOpenNextFromQueue("skip-task");
        return;
      }
      setValueNoScroll(fTempo, choice.tempo);
    }

    const missingAfterTempo = pitGetMissingRequiredFields();
    if (missingAfterTempo.length) {
      alert(`Faltou algum campo obrigatorio (${missingAfterTempo.join(", ")}). Vou parar o lote PIT.`);
      pitClearBatch();
      return;
    }

    sessionStorage.setItem(PIT_SS_LAST, key);
    pitRemoveCurrentFromQueue(ids.pitId, ids.entregaId);
    pitClickSave();

    setTimeout(() => {
      if (pitIsActive()) pitOpenNextFromQueue("after-save");
    }, 1400);
  }

  window.SUAP_EXT = window.SUAP_EXT || {};
  Object.assign(window.SUAP_EXT, {
    isPitSelectPage,
    pitInjectButtonsOnSelectPage,
    pitScheduleResumeIfActive,
    pitRunCadastroBatch
  });
})();







