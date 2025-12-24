// content/pit_single.js
(() => {
  if (window.__SUAP_EXT_PIT_SINGLE__) return;
  window.__SUAP_EXT_PIT_SINGLE__ = true;

  const { $, $$, norm, setValueNoScroll, brToISO, tempoToWidgetValue, styleLikeSave } = window.SUAP_EXT;

  function pitGetCadastroIds() {
    const m = location.pathname.match(/\/pgd2\/cadastrar_entrega_pit\/(\d+)\/(\d+)\/?$/i);
    return m ? { pitId: Number(m[1]), entregaId: Number(m[2]) } : null;
  }
  const isPitCadastro = () => !!pitGetCadastroIds();

  function pitSecondaryInfoValue(label) {
    const items = $$(".secondary-info .list-item");
    for (const it of items) {
      const dt = it.querySelector("dt");
      const dd = it.querySelector("dd");
      const t = norm(dt?.textContent).toLowerCase();
      if (t.includes(label.toLowerCase())) return norm(dd?.textContent);
    }
    return "";
  }

  function pitDescriptionFromExtraInfo() {
    const extra = $(".general-box .extra-info");
    if (!extra) return "";
    const nodes = Array.from(extra.children);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.tagName === "H5" && norm(n.textContent).toLowerCase() === "descrição") {
        const p = nodes[i + 1];
        if (p && p.tagName === "P") return norm(p.textContent);
      }
    }
    return "";
  }

  function pitExtractFromEntrega_onPIT() {
    const titulo = norm($(".general-box .title")?.textContent || "");
    const descricao = pitDescriptionFromExtraInfo();
    const prazoBR = pitSecondaryInfoValue("Prazo");
    const tempoPlanejadoTxt = pitSecondaryInfoValue("Tempo planejado"); // se existir
    return {
      titulo,
      descricao,
      prazoISO: brToISO(prazoBR),
      tempoPlanejado: tempoPlanejadoTxt ? tempoToWidgetValue(tempoPlanejadoTxt) : ""
    };
  }

  function pitFillOnce() {
    const form = $("#planoindividualtrabalhoentregascadastrar_form");
    if (!form) {
      alert("Não encontrei o formulário do PIT (#planoindividualtrabalhoentregascadastrar_form).");
      return;
    }

    const data = pitExtractFromEntrega_onPIT();

    const fTitulo = $("#id_titulo");
    const fDescricao = $("#id_descricao");
    const fPrazo = $("#id_data_prazo");
    const fTempo = $("#id_tempo_planejado");

    if (!fTitulo || !fDescricao || !fPrazo) {
      alert("Não encontrei os campos principais do PIT (ex.: #id_titulo, #id_descricao, #id_data_prazo).");
      return;
    }

    if (data.titulo) setValueNoScroll(fTitulo, data.titulo);
    if (data.descricao) setValueNoScroll(fDescricao, data.descricao);
    if (data.prazoISO && fPrazo) setValueNoScroll(fPrazo, data.prazoISO);

    // só preenche tempo planejado se conseguir extrair algo
    if (data.tempoPlanejado && fTempo) setValueNoScroll(fTempo, data.tempoPlanejado);
  }

  function injectPitFillButton() {
    if (!isPitCadastro()) return;

    const form = $("#planoindividualtrabalhoentregascadastrar_form");
    if (!form) return;

    const row = form.querySelector(".submit-row") || form;
    if ($("#tm-fill-pit-once")) return;

    const btn = document.createElement("button");
    btn.id = "tm-fill-pit-once";
    btn.type = "button";
    btn.textContent = "Preencher com dados do PES";
    styleLikeSave(btn, form);

    btn.addEventListener("click", pitFillOnce);
    row.prepend(btn);
  }

  window.SUAP_EXT = window.SUAP_EXT || {};
  Object.assign(window.SUAP_EXT, { isPitCadastro, injectPitFillButton });
})();