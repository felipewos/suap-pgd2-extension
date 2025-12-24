// service_worker.js (MV3, module)
const DEFAULTS = {
  // PRODUÇÃO: backend fixo (domínio próprio)
  apiBase: "https://api.proffelipewagner.com.br",
  cacheHours: 24
};

const STORAGE_KEYS = {
  settings: "settings",
  deviceId: "deviceId",

  // Compatibilidade com UI: representa o "usuário atual detectado no SUAP"
  boundUserKey: "boundUserKey",
  boundUserLabel: "boundUserLabel",

  // Legado (versões antigas)
  licenseKey: "licenseKey",

  // Licenças por usuário (map userKey -> licenseKey)
  licenseKeys: "licenseKeys",

  // Cache de acesso por usuário
  access: "access"
};

function nowMs() { return Date.now(); }

async function getFromStorage(keys) {
  return await chrome.storage.local.get(keys);
}

async function setInStorage(obj) {
  await chrome.storage.local.set(obj);
}

async function ensureDeviceId() {
  const { deviceId } = await getFromStorage([STORAGE_KEYS.deviceId]);
  if (deviceId) return deviceId;
  const id = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(16).slice(2) + "-" + nowMs());
  await setInStorage({ [STORAGE_KEYS.deviceId]: id });
  return id;
}

// IMPORTANTE: apiBase e cacheHours são FIXOS (não aceitam override por settings)
function sanitizeSettings(_raw) {
  // Ignora qualquer coisa que venha do usuário
  const apiBase = DEFAULTS.apiBase;
  const cacheHours = DEFAULTS.cacheHours;

  // Retorna só os campos aceitos (remove debug/testUserId/apiBase antigo etc.)
  return { apiBase, cacheHours };
}

async function ensureSettings() {
  const { settings } = await getFromStorage([STORAGE_KEYS.settings]);
  const clean = sanitizeSettings(settings || {});

  // evita escrever em storage toda hora (só se faltar ou estiver diferente)
  const same =
    settings &&
    typeof settings === "object" &&
    settings.apiBase === clean.apiBase &&
    settings.cacheHours === clean.cacheHours;

  if (!same) {
    await setInStorage({ [STORAGE_KEYS.settings]: clean });
  }

  return clean;
}

function estimateServerNow(access) {
  if (!access?.lastCheckedServerMs || !access?.lastCheckedClientMs) return null;
  return access.lastCheckedServerMs + (nowMs() - access.lastCheckedClientMs);
}

// Auto-expire local (melhora produção sem precisar clicar "Verificar status")
function autoExpireAccessIfNeeded(access) {
  if (!access) return { access: null, changed: false };

  const serverNow = estimateServerNow(access) ?? nowMs();
  let changed = false;
  let next = access;

  const mustExpireTrial =
    next.status === "trial_active" &&
    (!next.trialEndsAtMs || next.trialEndsAtMs <= serverNow);

  const mustExpireLicense =
    next.status === "paid_active" &&
    (!next.licenseEndsAtMs || next.licenseEndsAtMs <= serverNow);

  if (mustExpireTrial || mustExpireLicense) {
    changed = true;
    next = {
      ...next,
      status: "expired_or_inactive",
      plan: null,
      lastCheckedServerMs: serverNow,
      lastCheckedClientMs: nowMs()
    };
  }

  return { access: next, changed };
}

function computeAccessState(payload) {
  // payload: { serverTimeMs, trial:{endsAtMs, active}, license:{active, plan, endsAtMs} }
  const serverTimeMs = payload.serverTimeMs;
  const licenseActive = !!payload.license?.active && payload.license.endsAtMs && payload.license.endsAtMs > serverTimeMs;
  const trialActive = !!payload.trial?.active && payload.trial.endsAtMs && payload.trial.endsAtMs > serverTimeMs;

  if (licenseActive) {
    return {
      status: "paid_active",
      plan: payload.license.plan || "basic",
      trialEndsAtMs: payload.trial?.endsAtMs || null,
      licenseEndsAtMs: payload.license.endsAtMs,
      serverTimeMs
    };
  }

  if (trialActive) {
    return {
      status: "trial_active",
      plan: "pro", // trial libera tudo
      trialEndsAtMs: payload.trial.endsAtMs,
      licenseEndsAtMs: null,
      serverTimeMs
    };
  }

  return {
    status: "expired_or_inactive",
    plan: null,
    trialEndsAtMs: payload.trial?.endsAtMs || null,
    licenseEndsAtMs: payload.license?.endsAtMs || null,
    serverTimeMs
  };
}

async function apiPost(path, body) {
  const settings = await ensureSettings();
  const url = settings.apiBase.replace(/\/+$/, "") + path;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if (!res.ok) {
    const err = new Error(`API ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function normalizeLicenseKeys(raw) {
  if (!raw || typeof raw !== "object") return {};
  return raw;
}

async function ensureLicenseKeysInit() {
  const store = await getFromStorage([STORAGE_KEYS.licenseKeys]);
  if (!store[STORAGE_KEYS.licenseKeys]) {
    await setInStorage({ [STORAGE_KEYS.licenseKeys]: {} });
  }
}

async function migrateLegacyLicenseToCurrentUserIfNeeded(userKey) {
  if (!userKey) return;
  const store = await getFromStorage([STORAGE_KEYS.licenseKeys, STORAGE_KEYS.licenseKey]);
  const map = normalizeLicenseKeys(store[STORAGE_KEYS.licenseKeys]);
  const legacy = (store[STORAGE_KEYS.licenseKey] || "").trim();

  if (legacy && !map[userKey]) {
    map[userKey] = legacy;
    await setInStorage({
      [STORAGE_KEYS.licenseKeys]: map,
      [STORAGE_KEYS.licenseKey]: null
    });
  }
}

async function getLicenseKeyForUser(userKey) {
  await ensureLicenseKeysInit();
  await migrateLegacyLicenseToCurrentUserIfNeeded(userKey);
  const store = await getFromStorage([STORAGE_KEYS.licenseKeys]);
  const map = normalizeLicenseKeys(store[STORAGE_KEYS.licenseKeys]);
  const k = (map[userKey] || "").trim();
  return k || null;
}

async function setLicenseKeyForUser(userKey, licenseKey) {
  await ensureLicenseKeysInit();
  const store = await getFromStorage([STORAGE_KEYS.licenseKeys]);
  const map = normalizeLicenseKeys(store[STORAGE_KEYS.licenseKeys]);
  map[userKey] = (licenseKey || "").trim();
  await setInStorage({ [STORAGE_KEYS.licenseKeys]: map });
}

async function clearLicenseKeyForUser(userKey) {
  await ensureLicenseKeysInit();
  const store = await getFromStorage([STORAGE_KEYS.licenseKeys]);
  const map = normalizeLicenseKeys(store[STORAGE_KEYS.licenseKeys]);
  delete map[userKey];
  await setInStorage({ [STORAGE_KEYS.licenseKeys]: map });
}

async function setCurrentUser(userKey, userLabel) {
  await setInStorage({
    [STORAGE_KEYS.boundUserKey]: userKey,
    [STORAGE_KEYS.boundUserLabel]: userLabel || null
  });
}

async function refreshAccess({ force = false, userKey = null, userLabel = null } = {}) {
  const settings = await ensureSettings();

  const store = await getFromStorage([
    STORAGE_KEYS.boundUserKey,
    STORAGE_KEYS.boundUserLabel,
    STORAGE_KEYS.access
  ]);

  const currentUserKey = userKey || store.boundUserKey || null;
  const currentUserLabel = (userLabel ?? store.boundUserLabel) || null;

  if (!currentUserKey) return { ok: false, reason: "no_user" };

  const deviceId = await ensureDeviceId();

  // Cache só vale se for do mesmo usuário
  let cached = store.access || null;
  if (cached?.userKey && cached.userKey !== currentUserKey) cached = null;

  // Auto-expire do cache
  if (cached) {
    const { access: exp, changed } = autoExpireAccessIfNeeded(cached);
    if (changed) {
      cached = exp;
      await setInStorage({ [STORAGE_KEYS.access]: cached });
    }
  }

  // Use cached if fresh
  if (!force && cached?.lastCheckedServerMs && cached?.lastCheckedClientMs) {
    const serverNow = estimateServerNow(cached);
    const ageMs = serverNow != null ? (serverNow - cached.lastCheckedServerMs) : Infinity;
    const maxAgeMs = (settings.cacheHours || 24) * 60 * 60 * 1000;
    if (ageMs >= 0 && ageMs < maxAgeMs) return { ok: true, access: cached, fromCache: true };
  }

  const licenseKey = await getLicenseKeyForUser(currentUserKey);

  try {
    let payload = null;

    // 1) tenta licença (se tiver)
    if (licenseKey) {
      try {
        payload = await apiPost("/api/license/verify", {
          licenseKey,
          extensionId: chrome.runtime.id,
          boundUserKey: currentUserKey,
          deviceId
        });
      } catch (e) {
        // se licença não serve para este usuário: cai para bind/trial
        if (e?.status !== 403 && e?.status !== 404) throw e;
        payload = null;
      }
    }

    // 2) sem licença válida: bind idempotente (inicia trial do usuário uma vez)
    if (!payload) {
      payload = await apiPost("/api/auth/bind", {
        extensionId: chrome.runtime.id,
        boundUserKey: currentUserKey,
        deviceId,
        boundUserLabel: currentUserLabel
      });
    }

    const state = computeAccessState(payload);

    const access = {
      userKey: currentUserKey,
      status: state.status,
      plan: state.plan,
      trialEndsAtMs: state.trialEndsAtMs,
      licenseEndsAtMs: state.licenseEndsAtMs,
      lastCheckedServerMs: state.serverTimeMs,
      lastCheckedClientMs: nowMs()
    };

    await setInStorage({ [STORAGE_KEYS.access]: access });
    return { ok: true, access, fromCache: false };

  } catch (e) {
    // Offline/API down: se cache (mesmo usuário) estiver fresco, usa.
    if (cached?.lastCheckedServerMs && cached?.lastCheckedClientMs) {
      const { access: exp, changed } = autoExpireAccessIfNeeded(cached);
      if (changed) {
        cached = exp;
        await setInStorage({ [STORAGE_KEYS.access]: cached });
      }

      const serverNow = estimateServerNow(cached);
      const maxAgeMs = (settings.cacheHours || 24) * 60 * 60 * 1000;
      const isStale = serverNow == null || (serverNow - cached.lastCheckedServerMs) >= maxAgeMs;

      if (!isStale) return { ok: true, access: cached, fromCache: true, apiError: true };

      const blocked = {
        userKey: currentUserKey,
        status: "expired_or_inactive",
        plan: null,
        trialEndsAtMs: cached.trialEndsAtMs || null,
        licenseEndsAtMs: cached.licenseEndsAtMs || null,
        lastCheckedServerMs: cached.lastCheckedServerMs,
        lastCheckedClientMs: cached.lastCheckedClientMs
      };
      await setInStorage({ [STORAGE_KEYS.access]: blocked });
      return { ok: true, access: blocked, fromCache: true, apiError: true };
    }

    const blocked = {
      userKey: currentUserKey,
      status: "expired_or_inactive",
      plan: null,
      trialEndsAtMs: null,
      licenseEndsAtMs: null,
      lastCheckedServerMs: null,
      lastCheckedClientMs: null
    };
    await setInStorage({ [STORAGE_KEYS.access]: blocked });
    return { ok: true, access: blocked, apiError: true };
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureSettings();
  await ensureDeviceId();
  await ensureLicenseKeysInit();

  const { access } = await getFromStorage([STORAGE_KEYS.access]);
  if (!access) {
    await setInStorage({
      [STORAGE_KEYS.access]: {
        userKey: null,
        status: "expired_or_inactive",
        plan: null,
        trialEndsAtMs: null,
        licenseEndsAtMs: null,
        lastCheckedServerMs: null,
        lastCheckedClientMs: null
      }
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || typeof msg !== "object") return sendResponse({ ok: false, error: "bad_msg" });

      if (msg.type === "GET_STATE") {
        const settings = await ensureSettings();
        const store = await getFromStorage([
          STORAGE_KEYS.boundUserKey,
          STORAGE_KEYS.boundUserLabel,
          STORAGE_KEYS.access
        ]);

        let access = store.access || null;
        if (access) {
          const { access: exp, changed } = autoExpireAccessIfNeeded(access);
          access = exp;
          if (changed) await setInStorage({ [STORAGE_KEYS.access]: access });
        }

        const currentUserKey = store.boundUserKey || null;
        const currentLicense = currentUserKey ? await getLicenseKeyForUser(currentUserKey) : null;

        return sendResponse({
          ok: true,
          extensionId: chrome.runtime.id,
          settings,
          boundUserKey: currentUserKey,
          boundUserLabel: store.boundUserLabel || null,
          licenseKey: currentLicense,
          access
        });
      }

      if (msg.type === "SAVE_SETTINGS") {
        // Mantém fixo (só regrava defaults limpos)
        const clean = sanitizeSettings({});
        await setInStorage({ [STORAGE_KEYS.settings]: clean });
        return sendResponse({ ok: true, settings: clean });
      }

      if (msg.type === "USER_SEEN") {
        const { userKey, userLabel } = msg;
        if (!userKey) return sendResponse({ ok: false, error: "missing_userKey" });

        await setCurrentUser(userKey, userLabel || null);

        const ref = await refreshAccess({ force: false, userKey, userLabel: userLabel || null });
        const state = await getFromStorage([STORAGE_KEYS.access, STORAGE_KEYS.boundUserLabel]);

        return sendResponse({
          ok: true,
          allowed: true,
          access: state.access,
          boundUserLabel: state.boundUserLabel || null,
          licenseKey: await getLicenseKeyForUser(userKey),
          fromCache: ref.fromCache || false,
          apiError: ref.apiError || false
        });
      }

      if (msg.type === "SET_LICENSE_KEY") {
        const key = (msg.licenseKey || "").trim();
        if (!key) return sendResponse({ ok: false, error: "empty_licenseKey" });

        const store = await getFromStorage([STORAGE_KEYS.boundUserKey, STORAGE_KEYS.boundUserLabel]);
        const currentUserKey = store.boundUserKey || null;
        const currentUserLabel = store.boundUserLabel || null;

        if (!currentUserKey) return sendResponse({ ok: false, error: "no_user_open_suap" });

        await setLicenseKeyForUser(currentUserKey, key);
        const ref = await refreshAccess({ force: true, userKey: currentUserKey, userLabel: currentUserLabel });

        if (!ref.ok) return sendResponse({ ok: false, error: ref.reason || "verify_failed" });
        return sendResponse({ ok: true, access: ref.access });
      }

      if (msg.type === "CLEAR_LICENSE_KEY") {
        const store = await getFromStorage([STORAGE_KEYS.boundUserKey, STORAGE_KEYS.boundUserLabel]);
        const currentUserKey = store.boundUserKey || null;
        const currentUserLabel = store.boundUserLabel || null;

        if (currentUserKey) await clearLicenseKeyForUser(currentUserKey);

        const ref = await refreshAccess({ force: true, userKey: currentUserKey, userLabel: currentUserLabel });
        return sendResponse({ ok: true, access: ref.ok ? ref.access : null });
      }

      if (msg.type === "FORCE_VERIFY") {
        const store = await getFromStorage([STORAGE_KEYS.boundUserKey, STORAGE_KEYS.boundUserLabel]);
        const currentUserKey = store.boundUserKey || null;
        const currentUserLabel = store.boundUserLabel || null;

        const ref = await refreshAccess({ force: true, userKey: currentUserKey, userLabel: currentUserLabel });
        if (!ref.ok) return sendResponse({ ok: false, error: ref.reason || "verify_failed" });

        return sendResponse({ ok: true, access: ref.access, fromCache: ref.fromCache || false, apiError: ref.apiError || false });
      }

      if (msg.type === "REBIND") {
        return sendResponse({ ok: false, error: "rebind_not_used_in_user_mode" });
      }

      return sendResponse({ ok: false, error: "unknown_type" });
    } catch (e) {
      return sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();

  return true; // async
});
