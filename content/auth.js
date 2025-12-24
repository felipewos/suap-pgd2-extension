// content/auth.js
(() => {
  if (window.__SUAP_EXT_AUTH__) return;
  window.__SUAP_EXT_AUTH__ = true;

  async function send(msg) {
    return await chrome.runtime.sendMessage(msg);
  }

  function canUseSingle(access) {
    return access?.status === "trial_active" || access?.status === "paid_active";
  }

  function canUseBatch(access) {
    if (access?.status === "trial_active") return true;
    return access?.status === "paid_active" && access?.plan === "pro";
  }

  window.SUAP_EXT = window.SUAP_EXT || {};
  Object.assign(window.SUAP_EXT, { send, canUseSingle, canUseBatch });
})();