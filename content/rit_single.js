// content/rit_single.js
(() => {
  if (window.__SUAP_EXT_RIT_SINGLE__) return;
  window.__SUAP_EXT_RIT_SINGLE__ = true;

  const { $, $$, norm, setIfEmptyNoScroll, setRichTextNoScroll, tempoToWidgetValue, styleLikeSave } = window.SUAP_EXT;

  const clean = (txt) => norm(txt).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  function getDefinitionValue(container, labelText) {
    const target = clean(labelText);
    for (const dt of $$("dt", container)) {
      const k = clean(dt.textContent).replace(/\s*:\s*$/, "");
      if (!(k === target || k.includes(target))) continue;
      const dd = dt.parentElement?.querySelector("dd") ||
        (dt.nextElementSibling?.tagName === "DD" ? dt.nextElementSibling : null);
      const value = norm(dd?.innerText || dd?.textContent || "");
      if (value) return value;
    }
    return "";
  }

  function getExtraInfoDescription(container) {
    const extras = $$(".extra-info", container);
    for (const extra of extras) {
      const nodes = Array.from(extra.children);
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const isLabelTag = /^(H3|H4|H5|LABEL|STRONG|B)$/i.test(node.tagName || "");
        const isDescriptionLabel = isLabelTag && /descricao/i.test(clean(node.textContent || ""));
        if (!isDescriptionLabel) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const value = norm(nodes[j].innerText || nodes[j].textContent || "");
          if (value && !/descricao/i.test(clean(value))) return value;
        }
      }
    }
    return "";
  }

  function getLooseDescription(container) {
    const labels = $$("h3, h4, h5, dt, strong, b, label, .label", container);
    for (const label of labels) {
      if (!/descricao/i.test(clean(label.textContent || ""))) continue;
      let node = label.nextElementSibling;
      while (node) {
        const value = norm(node.innerText || node.textContent || "");
        if (value && !/descricao/i.test(clean(value))) return value;
        node = node.nextElementSibling;
      }
    }
    return "";
  }

  function getPanelDescription(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return "";
    return getDefinitionValue(panel, "Descricao") ||
      getExtraInfoDescription(panel) ||
      getLooseDescription(panel);
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

    const titulo = getDefinitionValue(pitPanel, "Titulo");
    const descricao =
      getPanelDescription("entrega-do-pit") ||
      getPanelDescription("entrega-do-pes");
    const prazo = getDefinitionValue(pitPanel, "Prazo");
    const tempoPlanejado = getDefinitionValue(pitPanel, "Tempo planejado");
    return { titulo, descricao, prazo, tempoPlanejado };
  }

  function fillRIT() {
    const pit = extractFromPIT();
    if (!pit) {
      alert("NÃ£o encontrei o bloco 'Entrega do PIT' (#entrega-do-pit).");
      return;
    }

    const fTitulo = $("#id_titulo");
    const fDescricao = $("#id_descricao");
    const fIni = $("#id_data_inicio");
    const fFim = $("#id_data_fim");
    const fHoras = $("#id_tempo_executado");
    const fQtd = $("#id_quantidade_progresso");

    if (!fTitulo || !fDescricao) {
      alert("NÃ£o encontrei os campos do formulÃ¡rio do RIT (ex.: #id_titulo, #id_descricao).");
      return;
    }

    setIfEmptyNoScroll("#id_titulo", pit.titulo);
    if (pit.descricao) setRichTextNoScroll(fDescricao, pit.descricao);

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

    const locked = !!window.SUAP_EXT?.lockedAccess;
    const btn = document.createElement("button");
    btn.id = "tm-fill-rit-once";
    btn.type = "button";
    btn.textContent = locked ? "Comprar licença (trial expirado)" : "Preencher com dados do PIT";
    styleLikeSave(btn, form);
    if (locked) {
      btn.style.background = "#c20a0a";
      btn.style.borderColor = "#c20a0a";
    }
    btn.addEventListener("click", () => {
      if (locked) {
        window.SUAP_EXT.openBuyPopup?.();
        return;
      }
      fillRIT();
    });
    row.prepend(btn);
  }

  window.SUAP_EXT = window.SUAP_EXT || {};
  Object.assign(window.SUAP_EXT, { isRitCadastro, injectRitFillButton });
})();



