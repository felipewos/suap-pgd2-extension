// content/suap_user.js
(() => {
  if (window.__SUAP_EXT_USER__) return;
  window.__SUAP_EXT_USER__ = true;

  const { $, $$, norm } = window.SUAP_EXT;

  function pickFirstNonEmpty(values) {
    for (const v of values) {
      const t = norm(v);
      if (t) return t;
    }
    return "";
  }

  function extractFromUserTools() {
    // comum no SUAP: #user-tools select option com nome + matricula
    const option = $("#user-tools select option");
    const optionText = norm(option?.textContent);
    const optionValue = norm(option?.value);

    // tentar pegar matrícula do texto/valor
    const m1 = optionText.match(/(\d{5,})/);
    if (m1) return { id: m1[1], label: optionText };

    const m2 = optionValue.match(/(\d{5,})/);
    if (m2) return { id: m2[1], label: optionText || optionValue };

    // link /rh/servidor/<id>/
    const a = $("#user-tools a[href*='/rh/servidor/'], #user-tools a[href*='/pessoa/']");
    const href = a?.getAttribute("href") || "";
    const m3 = href.match(/\/rh\/servidor\/(\d{5,})\//) || href.match(/\/pessoa\/(\d{5,})\//);
    if (m3) return { id: m3[1], label: norm(a.textContent) || m3[1] };

    return null;
  }

  function extractFromTitleOrHeader() {
    const t = document.title || "";
    let m = t.match(/\((\d{5,})\)/);
    if (m) return { id: m[1], label: t };

    const h1 = pickFirstNonEmpty([
      $("h1")?.textContent,
      $("h2")?.textContent,
      $(".title-container h2")?.textContent,
      $(".title-container h1")?.textContent
    ]);

    m = h1.match(/\((\d{5,})\)/);
    if (m) return { id: m[1], label: h1 };

    return null;
  }

  function getSuapUserIdentifier() {
    return extractFromUserTools() || extractFromTitleOrHeader();
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  window.SUAP_EXT = window.SUAP_EXT || {};
  Object.assign(window.SUAP_EXT, { getSuapUserIdentifier, sha256Hex });
})();