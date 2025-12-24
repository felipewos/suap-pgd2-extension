// content/pit_batch.js
(() => {
  if (window.__SUAP_EXT_PIT_BATCH__) return;
  window.__SUAP_EXT_PIT_BATCH__ = true;

  const { $, $$, norm, brToISO, makeBtn, setValueNoScroll } = window.SUAP_EXT;

  const PIT_LS_QUEUE = "__SUAP_PIT_BATCH_QUEUE_PATHS__";
  const PIT_LS_ACTIVE = "__SUAP_PIT_BATCH_ACTIVE__";
  const PIT_SS_LAST = "__SUAP_PIT_BATCH_LAST_SAVED_KEY__";
  const PIT_SS_LAST_TEMPO = "__SUAP_PIT_BATCH_LAST_TEMPO__";

  const pitGetQueue = () => { try { return JSON.parse(localStorage.getItem(PIT_LS_QUEUE) || "[]"); } catch { return []; } };
  const pitSetQueue = (q) => localStorage.setItem(PIT_LS_QUEUE, JSON.stringify(q || []));
  const pitIsActive = () => localStorage.getItem(PIT_LS_ACTIVE) === "1";
  const pitSetActive = (v) => localStorage.setItem(PIT_LS_ACTIVE, v ? "1" : "0");

  function pitGetCadastroIds() {
    const m = location.pathname.match(/\/pgd2\/cadastrar_entrega_pit\/(\d+)\/(\d+)\/?$/i);
    return m ? { pitId: Number(m[1]), entregaId: Number(m[2]) } : null;
  }
  const isPitCadastro = () => !!pitGetCadastroIds();

  function isPitSelectPage() {
    if (!/\/pgd2\/selecionar_entrega_pes_cadastrar_entrega_pit\/\d+\/?$/i.test(location.pathname)) return false;
    return $$('a[href^="/pgd2/cadastrar_entrega_pit/"]').some(a => /selecionar/i.test(norm(a.textContent)));
  }

  function pitClearBatch() {
    pitSetActive(false);
    pitSetQueue([]);
    sessionStorage.removeItem(PIT_SS_LAST);
    document.getElementById("tm-pit-batch-stop-float")?.remove();
  }

  function pitEnsureStopFloat() {
    const shouldShow = pitIsActive() && (isPitSelectPage() || isPitCadastro());
    const existing = document.getElementById("tm-pit-batch-stop-float");

    if (!shouldShow) { existing?.remove(); return; }
    if (existing) return;

    const wrap = document.createElement("div");
    wrap.id = "tm-pit-batch-stop-float";
    wrap.className = "tm-ext-float-top-right";

    const stop = makeBtn("Parar lote", "danger");
    stop.id = "tm-pit-batch-stop";
    stop.addEventListener("click", () => { pitClearBatch(); alert("Lote PIT interrompido."); });

    wrap.appendChild(stop);
    document.body.appendChild(wrap);
  }

  function pitCollectCadastroPathsFromSelectPage() {
    const paths = $$('a[href^="/pgd2/cadastrar_entrega_pit/"]')
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
      pitClearBatch();
      alert("Lote PIT concluído.");
      return;
    }

    const nextPath = q[0];
    const u = new URL(nextPath, location.origin);
    u.searchParams.set("__tm_pit_batch", "1");

    window.__TM_PIT_BATCH_NAV__ = true;
    console.log("[SUAP PIT] Próxima:", nextPath, reason ? `(${reason})` : "");
    location.href = u.toString();
  }

  function pitRemoveCurrentFromQueue(pitId, entregaId) {
    pitSetQueue(pitGetQueue().filter(p => !p.includes(`/cadastrar_entrega_pit/${pitId}/${entregaId}`)));
  }

  function pitScheduleResumeIfActive(reason = "") {
    // mantém o stop flutuante mesmo quando não vai navegar agora
    if (isPitSelectPage() || isPitCadastro()) pitEnsureStopFloat();

    if (!pitIsActive()) return;
    if (!pitGetQueue().length) return;
    if (window.__TM_PIT_BATCH_NAV__) return;
    setTimeout(() => pitOpenNextFromQueue(reason), 900);
  }

  function pitGetTopHost() {
    // preferencial: action bar ao lado do título
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

    const start = makeBtn("Preencher e salvar todas (lote)", "success");
    start.id = "tm-pit-batch-start";
    start.addEventListener("click", () => {
      const paths = pitCollectCadastroPathsFromSelectPage();
      if (!paths.length) { alert("Não encontrei links 'Selecionar' nesta página."); return; }
      pitSetQueue(paths);
      pitSetActive(true);
      sessionStorage.removeItem(PIT_SS_LAST);
      pitEnsureStopFloat();
      pitOpenNextFromQueue("start");
    });

    const li1 = document.createElement("li");
    li1.appendChild(start);
    bar.appendChild(li1);

    // Se já estiver rodando, mostra "Parar lote" no topo-direito
    pitEnsureStopFloat();
  }

  function pitFindDlValueByLabel(labelRegex) {
    const nodes = $$("dl.secondary-info .list-item, dl.definition-list .list-item, .definition-list .list-item");
    for (const it of nodes) {
      const dt = it.querySelector("dt");
      const dd = it.querySelector("dd");
      if (!dt || !dd) continue;
      const k = norm(dt.textContent).replace(/\s*:\s*$/, "");
      if (labelRegex.test(k)) return norm(dd.textContent);
    }
    return "";
  }

  function pitExtractInfoFromCadastroPage() {
    const box = $(".general-box") || $(".content .general-box") || null;

    let titulo = "";
    const titleEl = box?.querySelector(".primary-info .title, h4.title, h3.title") || $(".primary-info .title, h4.title, h3.title");
    if (titleEl) {
      const clone = titleEl.cloneNode(true);
      clone.querySelectorAll("small").forEach(s => s.remove());
      titulo = norm(clone.textContent);
    }

    let descricao = "";
    const extra = box?.querySelector(".extra-info") || $(".extra-info");
    if (extra) {
      const h5s = Array.from(extra.querySelectorAll("h5"));
      for (const h5 of h5s) {
        if (/^descri[cç][aã]o$/i.test(norm(h5.textContent))) {
          const p = h5.nextElementSibling;
          if (p && p.tagName && p.tagName.toLowerCase() === "p") descricao = (p.innerText || p.textContent || "").trim();
          break;
        }
      }
    }

    const prazoBR = pitFindDlValueByLabel(/^Prazo$/i) || pitFindDlValueByLabel(/Prazo/i);
    return { titulo, descricao, prazoBR };
  }

  function pitAskTempoPlanejado() {
    const last = sessionStorage.getItem(PIT_SS_LAST_TEMPO) || "";
    const v = prompt("Tempo planejado (horas decimais, ex: 2,50):", last || "1,00");
    if (v === null) return null;
    const cleaned = norm(v);
    if (!cleaned) return "";
    sessionStorage.setItem(PIT_SS_LAST_TEMPO, cleaned);
    return cleaned;
  }

  function pitIsCadastroReady() {
    return $("#planoindividualtrabalhoentregascadastrar_form") && $("#id_titulo") && $("#id_descricao") && $("#id_data_prazo") && $("#id_tempo_planejado");
  }

  function pitRequiredOk() {
    const need = ["#id_titulo", "#id_descricao", "#id_data_prazo", "#id_tempo_planejado"];
    return need.every(sel => norm(document.querySelector(sel)?.value));
  }

  function pitClickSave() {
    const form = $("#planoindividualtrabalhoentregascadastrar_form");
    const btn = form?.querySelector('input[type="submit"][value="Salvar"], button[type="submit"], input[type="submit"]');
    if (btn) btn.click();
    else form?.submit();
  }

  function pitRunCadastroBatch() {
    if (!isPitCadastro()) return;

    // Se o lote estiver ativo, garante o "Parar lote" no topo-direito (mesmo fora do fluxo __tm_pit_batch)
    pitEnsureStopFloat();

    if (!pitIsActive()) return;

    const params = new URLSearchParams(location.search);
    if (params.get("__tm_pit_batch") !== "1") return;

    if (window.__TM_PIT_BATCH_RAN__) return;
    window.__TM_PIT_BATCH_RAN__ = true;

    const ids = pitGetCadastroIds();
    if (!ids) return;

    const key = `${ids.pitId}:${ids.entregaId}`;
    const lastKey = sessionStorage.getItem(PIT_SS_LAST) || "";
    if (lastKey === key) {
      pitRemoveCurrentFromQueue(ids.pitId, ids.entregaId);
      pitOpenNextFromQueue("already-saved");
      return;
    }

    const start = Date.now();
    const timer = setInterval(() => {
      if (pitIsCadastroReady()) {
        clearInterval(timer);

        const info = pitExtractInfoFromCadastroPage();

        const fTitulo = $("#id_titulo");
        const fDescricao = $("#id_descricao");
        const fPrazo = $("#id_data_prazo");
        const fTempo = $("#id_tempo_planejado");

        if (info.titulo) setValueNoScroll(fTitulo, info.titulo);
        if (info.descricao) setValueNoScroll(fDescricao, info.descricao);

        const prazoISO = brToISO(info.prazoBR);
        if (prazoISO) setValueNoScroll(fPrazo, prazoISO);

        const tempoAtual = norm(fTempo.value);
        const precisaPerguntar = !tempoAtual || tempoAtual === "0,00" || tempoAtual === "0" || tempoAtual === "0,0";
        if (precisaPerguntar) {
          const tempo = pitAskTempoPlanejado();
          if (tempo === null) { pitClearBatch(); alert("Lote PIT interrompido."); return; }
          if (!tempo) { pitClearBatch(); alert("Tempo planejado inválido. Vou parar o lote PIT."); return; }
          setValueNoScroll(fTempo, tempo);
        }

        if (!pitRequiredOk()) {
          alert("Faltou algum campo obrigatório (Título/Descrição/Prazo/Tempo). Vou parar o lote PIT.");
          pitClearBatch();
          return;
        }

        sessionStorage.setItem(PIT_SS_LAST, key);
        pitRemoveCurrentFromQueue(ids.pitId, ids.entregaId); // anti-loop antes de salvar
        pitClickSave();

        setTimeout(() => {
          if (pitIsActive()) pitOpenNextFromQueue("after-save");
        }, 1400);

      } else if (Date.now() - start > 15000) {
        clearInterval(timer);
        alert("Timeout: a tela de cadastro do PIT não carregou. Vou parar o lote PIT.");
        pitClearBatch();
      }
    }, 250);
  }

  window.SUAP_EXT = window.SUAP_EXT || {};
  Object.assign(window.SUAP_EXT, {
    isPitSelectPage,
    pitInjectButtonsOnSelectPage,
    pitScheduleResumeIfActive,
    pitRunCadastroBatch
  });
})();
