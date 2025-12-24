// content/styles_inject.js
(() => {
  if (window.__SUAP_EXT_STYLES__) return;
  window.__SUAP_EXT_STYLES__ = true;

  // Pequeno CSS para garantir que os botões fiquem alinhados no action-bar do SUAP
  const css = `
    .tm-ext-actionbar-host{ display:flex !important; justify-content:flex-end !important; align-items:center !important; gap:8px !important; }
    .tm-ext-actionbar-host > li{ list-style:none !important; margin:0 !important; padding:0 !important; }
    .tm-ext-float{ position:fixed; right:16px; bottom:16px; z-index:999999; display:flex; gap:8px; }
    .tm-ext-float-top-right{ position:fixed; right:16px; top:16px; z-index:999999; display:flex; gap:8px; }
    .tm-ext-disabled{ opacity:.55; cursor:not-allowed !important; filter:grayscale(40%); }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.documentElement.appendChild(style);
})();
