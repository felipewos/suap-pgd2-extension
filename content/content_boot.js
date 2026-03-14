// content/content_boot.js
(async () => {
  if (window.__SUAP_EXT_BOOT__) return;
  window.__SUAP_EXT_BOOT__ = true;

  if (!String(location.hostname || "").startsWith("suap.")) return;

  const { getSuapUserIdentifier, sha256Hex, send, canUseSingle, canUseBatch } = window.SUAP_EXT;

  // 1) identificar usuário SUAP
  const ident = getSuapUserIdentifier();
  if (!ident?.id) return;

  const userKey = await sha256Hex(String(ident.id));
  const userLabel = ident.label || String(ident.id);

  // 2) registrar no background + checar licença/trial
  const res = await send({ type: "USER_SEEN", userKey, userLabel });

  if (!res?.ok || !res.allowed) return;

  const access = res.access || null;
  const expired = access?.status === "expired_or_inactive";
  const allowSingle = canUseSingle(access);
  const allowBatch = canUseBatch(access);

  // flags e helper global para redirecionar compra
  window.SUAP_EXT.lockedAccess = expired;
  window.SUAP_EXT.openBuyPopup = () => {
    try {
      window.open(chrome.runtime.getURL("ui/popup.html"), "_blank", "noopener");
    } catch {
      try { window.open(chrome.runtime.getURL("ui/options.html"), "_blank", "noopener"); }
      catch { alert("Abra o popup da extensão para comprar a licença."); }
    }
  };

  if (!allowSingle && !allowBatch && !expired) return;

  // 3) Rodar features (respeitando plano ou em modo bloqueado)
  const canShowSingle = allowSingle || expired;
  if (canShowSingle) {
    window.SUAP_EXT.injectPitFillButton?.();
    window.SUAP_EXT.injectRitFillButton?.();
  }

  const canShowBatchUi = allowBatch || expired;
  if (canShowBatchUi) {
    // PIT: botões na tela "Selecionar" + retomada automática (apenas se permitido)
    if (window.SUAP_EXT.isPitSelectPage?.()) {
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        window.SUAP_EXT.pitInjectButtonsOnSelectPage?.();
        if (document.getElementById("tm-pit-batch-start") || tries > 60) clearInterval(poll);
      }, 250);

      const mo = new MutationObserver(() => window.SUAP_EXT.pitInjectButtonsOnSelectPage?.());
      mo.observe(document.documentElement, { childList: true, subtree: true });

      if (allowBatch) window.SUAP_EXT.pitScheduleResumeIfActive?.("select-resume");
    }

    if (allowBatch) window.SUAP_EXT.pitScheduleResumeIfActive?.("any-page-resume");

    // RIT: mostra botão mesmo bloqueado (para compra)
    if ((allowBatch || expired) && window.SUAP_EXT.isRitViewPage?.()) {
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        window.SUAP_EXT.ritInjectButtonsOnViewPage?.();
        if (document.getElementById("tm-rit-batch-start") || tries > 40) clearInterval(poll);
      }, 250);

      const mo = new MutationObserver(() => window.SUAP_EXT.ritInjectButtonsOnViewPage?.());
      mo.observe(document.documentElement, { childList: true, subtree: true });

      setTimeout(() => {
        if (!document.getElementById("tm-rit-batch-start")) window.SUAP_EXT.ritInjectFloatingFallback?.();
      }, 2500);
    }

    // Rodar lotes no cadastro apenas quando permitido
    if (allowBatch) {
      window.SUAP_EXT.ritRunCadastroBatch?.();
      window.SUAP_EXT.pitRunCadastroBatch?.();
    }
  }
})();


