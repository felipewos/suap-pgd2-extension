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

  function pitSecondaryInfoValue(labels) {
    const lbls = Array.isArray(labels) ? labels : [labels];
    const items = $$(".secondary-info .list-item");
    for (const it of items) {
      const dt = it.querySelector("dt");
      const dd = it.querySelector("dd");
      if (!dt || !dd) continue;
      const t = norm(dt.textContent || "")
        .replace(/^[^a-z0-9]+/i, "")
        .replace(/\s*:\s*$/, "")
        .toLowerCase();
      const matched = lbls.some(lbl =>
        typeof lbl === "string"
          ? t.includes(lbl.toLowerCase())
          : (lbl instanceof RegExp ? lbl.test(t) : false)
      );
      if (matched) return norm(dd.textContent || "");
    }
    return "";
  }

  // Extrai a data final do perÃ­odo do PIT (ex.: "PIT - 01/02/2026 a 28/02/2026")
  function pitGetPeriodEndBR() {
    const textSources = [
      document.title || "",
      $(".title-container h2")?.textContent || "",
      $(".title-container h3")?.textContent || ""
    ];
    for (const txt of textSources) {
      const m = (txt || "").match(/PIT\s*-\s*(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
      if (m) return m[2];
    }
    return "";
  }

  // Devolve a data BR mais cedo entre duas datas BR (ou a que existir)
  function brEarliest(d1, d2) {
    const iso1 = brToISO(d1 || "");
    const iso2 = brToISO(d2 || "");
    if (iso1 && iso2) return (new Date(iso1) <= new Date(iso2)) ? d1 : d2;
    return d1 || d2 || "";
  }

  const clean = (txt) => norm(txt).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  function pitDescriptionFromExtraInfo() {
    const extra = $(".general-box .extra-info");
    if (!extra) return "";
    const nodes = Array.from(extra.children);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.tagName === "H5" && /descricao/i.test(clean(n.textContent))) {
        const p = nodes[i + 1];
        if (p && p.tagName === "P") return norm(p.textContent);
      }
    }
    return "";
  }

  function pitExtractFromEntrega_onPIT() {
    const titulo = norm($(".general-box .title")?.textContent || "");
    const descricao = pitDescriptionFromExtraInfo();
    const prazoSecondary = pitSecondaryInfoValue([
      "prazo",
      "prazo final",
      "data limite",
      /prazo\s*limite/i
    ]);
    const prazoPitEnd = pitGetPeriodEndBR();
    const prazoBR = brEarliest(prazoSecondary, prazoPitEnd);
    const tempoPlanejadoTxt = pitSecondaryInfoValue(["tempo planejado", "tempo planeado", "tempo planjado"]); // se existir
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
      alert("NÃ£o encontrei o formulÃ¡rio do PIT (#planoindividualtrabalhoentregascadastrar_form).");
      return;
    }

    const data = pitExtractFromEntrega_onPIT();

    const fTitulo = $("#id_titulo");
    const fDescricao = $("#id_descricao");
    const fPrazo = $("#id_data_prazo");
    const fTempo = $("#id_tempo_planejado");

    if (!fTitulo || !fDescricao || !fPrazo) {
      alert("NÃ£o encontrei os campos principais do PIT (ex.: #id_titulo, #id_descricao, #id_data_prazo).");
      return;
    }

    if (data.titulo) setValueNoScroll(fTitulo, data.titulo);
    if (data.descricao) setValueNoScroll(fDescricao, data.descricao);
    if (data.prazoISO && fPrazo) setValueNoScroll(fPrazo, data.prazoISO);

    // sÃ³ preenche tempo planejado se conseguir extrair algo
    if (data.tempoPlanejado && fTempo) setValueNoScroll(fTempo, data.tempoPlanejado);
  }

  function injectPitFillButton() {
    if (!isPitCadastro()) return;

    const form = $("#planoindividualtrabalhoentregascadastrar_form");
    if (!form) return;

    const row = form.querySelector(".submit-row") || form;
    if ($("#tm-fill-pit-once")) return;

    const locked = !!window.SUAP_EXT?.lockedAccess;
    const btn = document.createElement("button");
    btn.id = "tm-fill-pit-once";
    btn.type = "button";
    btn.textContent = locked ? "Comprar licença (trial expirado)" : "Preencher com dados do PES";
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
      pitFillOnce();
    });
    row.prepend(btn);
  }

  window.SUAP_EXT = window.SUAP_EXT || {};
  Object.assign(window.SUAP_EXT, { isPitCadastro, injectPitFillButton });
})();



