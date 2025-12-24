// content/rit_single.js
(() => {
  if (window.__SUAP_EXT_RIT_SINGLE__) return;
  window.__SUAP_EXT_RIT_SINGLE__ = true;

  const { $, $$, norm, setIfEmptyNoScroll, tempoToWidgetValue, styleLikeSave } = window.SUAP_EXT;

  function getDefinitionValue(container, labelText) {
    const items = $$(".definition-list .list-item", container);
    for (const it of items) {
      const dt = $("dt", it);
      const dd = $("dd", it);
      if (!dt || !dd) continue;
      const k = norm(dt.textContent).toLowerCase();
      if (k === labelText.toLowerCase()) return norm(dd.textContent);
    }
    return "";
  }

  function parseRangeFromTitle() {
    const t = document.title || "";
    const m = t.match(/de\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (!m) return null;
    const toISO = (br) => {
      const parts = br.split("/");
      if (parts.length !== 3) return "";
      const [dd, mm, yyyy] = parts;
      return `${yyyy}-${mm}-${dd}`;
    };
    return { ini: toISO(m[1]), fim: toISO(m[2]) };
  }

  function extractFromPIT() {
    const pitPanel = $("#entrega-do-pit");
    if (!pitPanel) return null;

    const titulo = getDefinitionValue(pitPanel, "Título");
    const descricao = getDefinitionValue(pitPanel, "Descrição");
    const prazo = getDefinitionValue(pitPanel, "Prazo");
    const tempoPlanejado = getDefinitionValue(pitPanel, "Tempo planejado");
    return { titulo, descricao, prazo, tempoPlanejado };
  }

  function fillRIT() {
    const pit = extractFromPIT();
    if (!pit) {
      alert("Não encontrei o bloco 'Entrega do PIT' (#entrega-do-pit).");
      return;
    }

    const fTitulo = $("#id_titulo");
    const fDescricao = $("#id_descricao");
    const fIni = $("#id_data_inicio");
    const fFim = $("#id_data_fim");
    const fHoras = $("#id_tempo_executado");
    const fQtd = $("#id_quantidade_progresso");

    if (!fTitulo || !fDescricao) {
      alert("Não encontrei os campos do formulário do RIT (ex.: #id_titulo, #id_descricao).");
      return;
    }

    setIfEmptyNoScroll("#id_titulo", pit.titulo);
    setIfEmptyNoScroll("#id_descricao", pit.descricao);

    const range = parseRangeFromTitle();
    if (range && fIni && fFim) {
      setIfEmptyNoScroll("#id_data_inicio", range.ini);
      setIfEmptyNoScroll("#id_data_fim", range.fim);
    }

    if (fHoras) {
      const horas = tempoToWidgetValue(pit.tempoPlanejado);
      if (horas) setIfEmptyNoScroll("#id_tempo_executado", horas);
    }

    if (fQtd && !fQtd.value) setIfEmptyNoScroll("#id_quantidade_progresso", "1");
  }

  function isRitCadastro() {
    return /\/pgd2\/cadastrar_entrega_rit\/\d+\/?$/i.test(location.pathname);
  }

  function injectRitFillButton() {
    if (!isRitCadastro()) return;

    const form = $("#relatorioindividualtrabalhocadastrar_form");
    if (!form) return;

    const row = form.querySelector(".submit-row") || form;
    if ($("#tm-fill-rit-once")) return;

    const btn = document.createElement("button");
    btn.id = "tm-fill-rit-once";
    btn.type = "button";
    btn.textContent = "Preencher com dados do PIT";
    styleLikeSave(btn, form);
    btn.addEventListener("click", fillRIT);
    row.prepend(btn);
  }

  window.SUAP_EXT = window.SUAP_EXT || {};
  Object.assign(window.SUAP_EXT, { isRitCadastro, injectRitFillButton });
})();