// content/rit_batch.js
(() => {
  if (window.__SUAP_EXT_RIT_BATCH__) return;
  window.__SUAP_EXT_RIT_BATCH__ = true;

  const { $, $$, norm, makeBtn, setIfEmptyNoScroll, tempoToWidgetValue } = window.SUAP_EXT;

  const RIT_LS_QUEUE = "__SUAP_RIT_BATCH_QUEUE_IDS__";
  const RIT_LS_ACTIVE = "__SUAP_RIT_BATCH_ACTIVE__";
  const RIT_SS_LAST = "__SUAP_RIT_BATCH_LAST_SAVED_ID__";

  const ritGetQueue = () => { try { return JSON.parse(localStorage.getItem(RIT_LS_QUEUE) || "[]"); } catch { return []; } };
  const ritSetQueue = (q) => localStorage.setItem(RIT_LS_QUEUE, JSON.stringify(q || []));
  const ritIsActive = () => localStorage.getItem(RIT_LS_ACTIVE) === "1";
  const ritSetActive = (v) => localStorage.setItem(RIT_LS_ACTIVE, v ? "1" : "0");

  function ritClearBatch() {
    ritSetActive(false);
    ritSetQueue([]);
    sessionStorage.removeItem(RIT_SS_LAST);
    document.getElementById("tm-rit-batch-stop-float")?.remove();
  }

  function isRitViewPage() {
    if (!/\/pgd2\/visualizar_rit\/\d+\/?/i.test(location.pathname)) return false;

    const hasLinks = $$('a[href^="/pgd2/cadastrar_entrega_rit/"]').length > 0;
    if (hasLinks) return true;

    const hasEntregas =
      $$("h1,h2,h3").some(h => /entregas/i.test(norm(h.textContent))) &&
      ($(".accordion-item") || $("div.accordion") || $$("[class*='accordion']").length);

    return hasEntregas;
  }

  function getCadastroId() {
    const m = location.pathname.match(/\/pgd2\/cadastrar_entrega_rit\/(\d+)\/?$/i);
    return m ? Number(m[1]) : null;
  }
  const isRitCadastro = () => getCadastroId() != null;

  function ritEnsureStopFloat() {
    const shouldShow = ritIsActive() && (isRitViewPage() || isRitCadastro());
    const existing = document.getElementById("tm-rit-batch-stop-float");

    if (!shouldShow) { existing?.remove(); return; }
    if (existing) return;

    const wrap = document.createElement("div");
    wrap.id = "tm-rit-batch-stop-float";
    wrap.className = "tm-ext-float-top-right";

    const stop = makeBtn("Parar lote", "danger");
    stop.id = "tm-rit-batch-stop";
    stop.addEventListener("click", () => { ritClearBatch(); alert("Lote RIT interrompido."); });

    wrap.appendChild(stop);
    document.body.appendChild(wrap);
  }

  function collectEntregaIdsFromView() {
    const ids = $$('a[href^="/pgd2/cadastrar_entrega_rit/"]')
      .map(a => a.getAttribute("href") || "")
      .map(h => (h.match(/\/pgd2\/cadastrar_entrega_rit\/(\d+)/i) || [])[1])
      .filter(Boolean)
      .map(n => Number(n))
      .filter(n => Number.isFinite(n));

    return Array.from(new Set(ids));
  }

  function openNextFromQueue() {
    const q = ritGetQueue();
    if (!q.length) {
      ritClearBatch();
      alert("Lote RIT concluído.");
      return;
    }
    const nextId = q[0];
    location.href = `${location.origin}/pgd2/cadastrar_entrega_rit/${nextId}/?__tm_rit_batch=1`;
  }

  function parseDateRangeFromTitle() {
    const t = document.title || "";
    const m = t.match(/de\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (!m) return null;
    const toISO = (br) => { const [dd, mm, yyyy] = br.split("/"); return `${yyyy}-${mm}-${dd}`; };
    return { ini: toISO(m[1]), fim: toISO(m[2]) };
  }

  function extractPIT_onRIT() {
    // MANTÉM O SELETOR ORIGINAL QUE FUNCIONA NO SUAP:
    const pit = $("#entrega-do-pit");
    if (!pit) return null;

    const map = new Map();
    for (const it of $$(".definition-list .list-item", pit)) {
      const dt = it.querySelector("dt");
      const dd = it.querySelector("dd");
      if (!dt || !dd) continue;
      map.set(norm(dt.textContent).toLowerCase(), norm(dd.textContent));
    }

    return {
      titulo: map.get("título") || map.get("titulo") || "",
      descricao: map.get("descrição") || map.get("descricao") || "",
      tempoPlanejado: map.get("tempo planejado") || ""
    };
  }

  function extractMetaQuantityDefault() {
    const dd = $$("dl.secondary-info dd")
      .map(n => norm(n.textContent))
      .find(t => /Quantidade\s*\(\s*\d+\s*\)/i.test(t));
    if (!dd) return null;
    const m = dd.match(/Quantidade\s*\(\s*(\d+)\s*\)/i);
    return m ? Number(m[1]) : null;
  }

  function isCadastroReady() {
    // MANTÉM O CHECK ORIGINAL:
    return $("#relatorioindividualtrabalhocadastrar_form") && $("#id_titulo") && $("#id_descricao") && $("#entrega-do-pit");
  }

  function fillCadastro() {
    const pit = extractPIT_onRIT();
    if (!pit) return false;

    setIfEmptyNoScroll("#id_titulo", pit.titulo);
    setIfEmptyNoScroll("#id_descricao", pit.descricao);

    const dr = parseDateRangeFromTitle();
    if (dr) {
      setIfEmptyNoScroll("#id_data_inicio", dr.ini);
      setIfEmptyNoScroll("#id_data_fim", dr.fim);
    }

    const horas = tempoToWidgetValue(pit.tempoPlanejado);
    if (horas) setIfEmptyNoScroll("#id_tempo_executado", horas);

    const q = extractMetaQuantityDefault();
    setIfEmptyNoScroll("#id_quantidade_progresso", String(q ?? 1));

    return true;
  }

  function requiredOk() {
    const need = ["#id_titulo", "#id_descricao", "#id_data_inicio", "#id_data_fim", "#id_tempo_executado", "#id_quantidade_progresso"];
    return need.every(sel => norm(document.querySelector(sel)?.value));
  }

  function clickSave() {
    const form = $("#relatorioindividualtrabalhocadastrar_form");
    const btn = form?.querySelector('input[type="submit"][value="Salvar"], button[type="submit"], input[type="submit"]');
    if (btn) btn.click();
    else form?.submit();
  }

  function findTopRightHost() {
    const hostByButtons =
      $$("button, a").find(el => /Planejamento\s*\(PIT\)/i.test(norm(el.textContent)))?.parentElement ||
      $$("button, a").find(el => /Consultas/i.test(norm(el.textContent)))?.parentElement;

    if (hostByButtons) return hostByButtons;

    const bar =
      $(".action-bar-container .action-bar") ||
      $(".action-bar") ||
      $(".action-links");

    if (bar) return bar;

    return $("#content") || document.body;
  }

  function ritInjectButtonsOnViewPage() {
    if (!isRitViewPage()) return;

    if ($("#tm-rit-batch-start") || $("#tm-rit-batch-start-float")) return;

    const host = findTopRightHost();
    if (!host) return;

    const start = makeBtn("Preencher e salvar todas (lote)", "success");
    start.id = "tm-rit-batch-start";
    start.addEventListener("click", () => {
      const ids = collectEntregaIdsFromView();
      if (!ids.length) { alert("Não encontrei links de entrega nesta página."); return; }
      ritSetQueue(ids);
      ritSetActive(true);
      sessionStorage.removeItem(RIT_SS_LAST);
      ritEnsureStopFloat();
      openNextFromQueue();
    });

    // Só o START fica no host (action-bar). O STOP vira flutuante topo-direito.
    host.appendChild(start);

    // Se já estiver ativo, garante o stop flutuante
    ritEnsureStopFloat();
  }

  function ritInjectFloatingFallback() {
    if (!isRitViewPage()) return;
    if ($("#tm-rit-batch-start") || $("#tm-rit-batch-start-float")) return;

    const wrap = document.createElement("div");
    wrap.id = "tm-rit-batch-float";
    wrap.className = "tm-ext-float";

    const start = makeBtn("Lote (salvar tudo)", "success");
    start.id = "tm-rit-batch-start-float";
    start.addEventListener("click", () => {
      const ids = collectEntregaIdsFromView();
      if (!ids.length) { alert("Não encontrei links de entrega nesta página."); return; }
      ritSetQueue(ids);
      ritSetActive(true);
      sessionStorage.removeItem(RIT_SS_LAST);
      ritEnsureStopFloat();
      openNextFromQueue();
    });

    // fallback flutuante fica SOMENTE com start
    wrap.appendChild(start);
    document.body.appendChild(wrap);

    // stop sempre no topo-direito, quando ativo
    ritEnsureStopFloat();
  }

  function ritRunCadastroBatch() {
    if (!isRitCadastro()) return;

    // Mantém o stop topo-direito enquanto estiver ativo
    ritEnsureStopFloat();

    if (!ritIsActive()) return;

    const params = new URLSearchParams(location.search);
    if (params.get("__tm_rit_batch") !== "1") return;

    const currentId = getCadastroId();
    if (!currentId) return;

    const lastSaved = Number(sessionStorage.getItem(RIT_SS_LAST) || "0");
    if (lastSaved === currentId) {
      ritSetQueue(ritGetQueue().filter(id => id !== currentId));
      openNextFromQueue();
      return;
    }

    const start = Date.now();
    const timer = setInterval(() => {
      if (isCadastroReady()) {
        clearInterval(timer);

        const filled = fillCadastro();
        if (!filled || !requiredOk()) {
          alert("Faltou algum campo obrigatório. Vou parar o lote para você revisar esta entrega.");
          ritClearBatch();
          return;
        }

        sessionStorage.setItem(RIT_SS_LAST, String(currentId));
        ritSetQueue(ritGetQueue().filter(id => id !== currentId)); // anti-loop
        clickSave();

        setTimeout(() => {
          if (ritIsActive()) openNextFromQueue();
        }, 1200);

      } else if (Date.now() - start > 15000) {
        clearInterval(timer);
        alert("Timeout: a tela de cadastro não carregou. Vou parar o lote RIT.");
        ritClearBatch();
      }
    }, 250);
  }

  window.SUAP_EXT = window.SUAP_EXT || {};
  Object.assign(window.SUAP_EXT, {
    isRitViewPage,
    ritInjectButtonsOnViewPage,
    ritInjectFloatingFallback,
    ritRunCadastroBatch
  });
})();
