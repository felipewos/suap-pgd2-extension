// content/styles_inject.js
(() => {
  if (window.__SUAP_EXT_STYLES__) return;
  window.__SUAP_EXT_STYLES__ = true;

  // Pequeno CSS para garantir que os botÃµes fiquem alinhados no action-bar do SUAP
  const css = `
    .tm-ext-actionbar-host{ display:flex !important; justify-content:flex-end !important; align-items:center !important; gap:8px !important; }
    .tm-ext-actionbar-host > li{ list-style:none !important; margin:0 !important; padding:0 !important; }
    .tm-ext-float{ position:fixed; right:16px; bottom:16px; z-index:999999; display:flex; gap:8px; }
    .tm-ext-float-top-right{ position:fixed; right:16px; top:16px; z-index:999999; display:flex; gap:8px; }
    .tm-ext-disabled{ opacity:.55; cursor:not-allowed !important; filter:grayscale(40%); }
    .tm-ext-panel{
      position:fixed;
      right:16px;
      top:16px;
      z-index:999999;
      width:min(360px, calc(100vw - 32px));
      padding:16px;
      border-radius:16px;
      background:linear-gradient(180deg, #081a33 0%, #0d2442 100%);
      color:#f5f8ff;
      box-shadow:0 18px 44px rgba(0,0,0,.28);
      border:1px solid rgba(255,255,255,.08);
      font-family:Segoe UI, Arial, sans-serif;
    }
    .tm-ext-panel-title{ font-size:18px; font-weight:700; margin:0 0 8px; }
    .tm-ext-panel-meta{ font-size:13px; line-height:1.45; color:#d9e6ff; margin:0 0 10px; }
    .tm-ext-panel-label{ display:block; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#a7c4ff; margin-bottom:6px; }
    .tm-ext-panel-task{ font-size:15px; line-height:1.4; color:#fff; margin:0 0 12px; }
    .tm-ext-panel-input{
      width:100%;
      box-sizing:border-box;
      border:1px solid #b8cae6 !important;
      background:#f7fbff !important;
      color:#0b1730 !important;
      caret-color:#0b1730 !important;
      border-radius:12px;
      padding:12px 14px;
      font-size:15px;
      margin-bottom:10px;
      outline:none;
    }
    .tm-ext-panel-input::placeholder{ color:#5e6f8d !important; }
    .tm-ext-panel-input:focus{
      border-color:#65b8ff;
      box-shadow:0 0 0 3px rgba(101,184,255,.18);
    }
    .tm-ext-panel-hint{ font-size:12px; line-height:1.45; color:#c6d7f5; margin:0 0 8px; }
    .tm-ext-panel-error{ min-height:18px; font-size:12px; color:#ffb5b5; margin:0 0 10px; }
    .tm-ext-panel-actions{ display:flex; flex-wrap:wrap; gap:8px; }
    .tm-ext-panel-actions .btn{ margin-left:0 !important; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.documentElement.appendChild(style);
})();

