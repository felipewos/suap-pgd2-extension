// content/util.js
(() => {
  if (window.__SUAP_EXT_UTIL__) return;
  window.__SUAP_EXT_UTIL__ = true;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const norm = (v) => (v ?? "").toString().replace(/\s+/g, " ").trim();

  function fire(el, type) { if (el) el.dispatchEvent(new Event(type, { bubbles: true })); }

  function hasValue(el) {
    if (!el) return false;
    if (norm(el.value)) return true;
    return !!norm(el.getAttribute("value"));
  }

  function setValueNoScroll(el, value) {
    if (!el) return false;
    const x = window.scrollX, y = window.scrollY;
    el.focus();
    el.value = value ?? "";
    fire(el, "input"); fire(el, "change"); fire(el, "keyup");
    el.blur();
    window.scrollTo(x, y);
    return true;
  }

  function setIfEmptyNoScroll(sel, value) {
    const el = $(sel);
    if (!el) return false;
    if (hasValue(el)) return false;
    return setValueNoScroll(el, value);
  }

  function waitFor(selector, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const el = $(selector);
      if (el) return resolve(el);

      const obs = new MutationObserver(() => {
        const found = $(selector);
        if (found) {
          obs.disconnect();
          resolve(found);
        }
      });

      obs.observe(document.documentElement, { childList: true, subtree: true });

      setTimeout(() => {
        obs.disconnect();
        reject(new Error("Timeout esperando: " + selector));
      }, timeoutMs);
    });
  }

  function brToISO(br) {
    const m = (br || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return "";
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }

  function tempoToWidgetValue(text) {
    // Converte vários formatos para horas decimais (pt-BR com vírgula)
    // "2h" -> "2,00"
    // "2h 30 min" -> "2,50"
    // "2h30" -> "2,50"
    // "2h 45 min" -> "2,75"
    // "07:10" -> "7,17"
    // "2.5h" / "2,5h" -> "2,50"
    if (!text) return "";
    const t = String(text).toLowerCase().replace(/\s+/g, " ").trim();

    // hh:mm
    let m = t.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
    if (m) {
      const hh = Number(m[1]), mm = Number(m[2]);
      if (!isFinite(hh) || !isFinite(mm)) return "";
      return (hh + mm / 60).toFixed(2).replace(".", ",");
    }

    // Xh Ymin | XhYmin | 0h 30m | 7h45
    m = t.match(/(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\s*(\d+)?\s*(?:min|mins|minutos|m)?/);
    if (m) {
      const horas = Number(String(m[1]).replace(",", "."));
      const mins = m[2] ? Number(m[2]) : 0;
      if (!isFinite(horas)) return "";
      const total = horas + (isFinite(mins) ? mins / 60 : 0);
      return total.toFixed(2).replace(".", ",");
    }

    // fallback: primeiro número
    m = t.match(/(\d+(?:[.,]\d+)?)/);
    if (!m) return "";
    const num = Number(String(m[1]).replace(",", "."));
    if (!isFinite(num)) return "";
    return num.toFixed(2).replace(".", ",");
  }

  function makeBtn(text, kind) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.className = `btn ${kind === "success" ? "success" : "danger"}`;

    // fallback visual (caso CSS do SUAP não aplique)
    b.style.whiteSpace = "nowrap";
    b.style.cursor = "pointer";
    b.style.borderRadius = "25px";
    b.style.border = "1px solid rgba(0,0,0,.15)";
    b.style.boxShadow = "0 6px 18px rgba(0,0,0,.12)";
    b.style.padding = kind === "success" ? "8px 12px" : "7px 10px";
    b.style.marginLeft = "8px";

    if (kind === "success") { b.style.background = "#008dcc"; b.style.color = "#fff"; b.style.borderColor = "#008dcc"; }
    else { b.style.background = "#c20a0a"; b.style.color = "#fff"; b.style.borderColor = "#c20a0a"; }

    return b;
  }

  function styleLikeSave(btn, form) {
    // tenta pegar o botão Salvar para copiar a altura/padding/line-height/font
    const row = form ? (form.querySelector(".submit-row") || form) : document.body;
    const ref =
      row?.querySelector('input[type="submit"], button[type="submit"]') ||
      form?.querySelector('input[type="submit"], button[type="submit"]');

    btn.className = ref?.className || "btn default";
    btn.style.marginRight = "8px";

    // cor azul padrão combinada com o SUAP (custom)
    btn.style.background = "#008dcc";
    btn.style.color = "#fff";
    btn.style.borderColor = "#008dcc";

    if (ref) {
      const cs = getComputedStyle(ref);
      btn.style.padding = cs.padding;
      btn.style.lineHeight = cs.lineHeight;
      btn.style.fontSize = cs.fontSize;
      btn.style.fontFamily = cs.fontFamily;
      btn.style.fontWeight = cs.fontWeight;
      if (cs.height && cs.height !== "auto") btn.style.height = cs.height;
    }
  }

  window.SUAP_EXT = window.SUAP_EXT || {};
  Object.assign(window.SUAP_EXT, {
    $, $$, norm,
    fire,
    hasValue,
    setValueNoScroll,
    setIfEmptyNoScroll,
    waitFor,
    brToISO,
    tempoToWidgetValue,
    makeBtn,
    styleLikeSave
  });
})();