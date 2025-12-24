// content/content_boot.js
(async () => {
  if (window.__SUAP_EXT_BOOT__) return;
  window.__SUAP_EXT_BOOT__ = true;

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
  const allowSingle = canUseSingle(access);
  const allowBatch = canUseBatch(access);

  if (!allowSingle && !allowBatch) return;

  // 3) Rodar features (respeitando plano)
  if (allowSingle) {
    window.SUAP_EXT.injectPitFillButton?.();
    window.SUAP_EXT.injectRitFillButton?.();
  }

  if (allowBatch) {
    // PIT: botões somente na tela "Selecionar" + retomada automática
    if (window.SUAP_EXT.isPitSelectPage?.()) {
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        window.SUAP_EXT.pitInjectButtonsOnSelectPage?.();
        if (document.getElementById("tm-pit-batch-start") || tries > 60) clearInterval(poll);
      }, 250);

      const mo = new MutationObserver(() => window.SUAP_EXT.pitInjectButtonsOnSelectPage?.());
      mo.observe(document.documentElement, { childList: true, subtree: true });

      window.SUAP_EXT.pitScheduleResumeIfActive?.("select-resume");
    }

    // RIT: botões na view do RIT
    if (window.SUAP_EXT.isRitViewPage?.()) {
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

    // Rodar lotes no cadastro (PIT e RIT) — independentes
    window.SUAP_EXT.ritRunCadastroBatch?.();
    window.SUAP_EXT.pitRunCadastroBatch?.();
  }
})();
