// lib/apiClient.js (ESM)
// Cliente HTTP simples usando fetch (compatível com MV3 / service worker)
//
// Uso:
// import { bindUser, trialStatus, verifyLicense, buildBuyUrl } from "./lib/apiClient.js";

const DEFAULT_BASE_URL = "https://api.proffelipewagner.com.br";
const FALLBACK_BASE_URL = "https://suap-pgd2-license-backend.felipewagner83.workers.dev";
const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status ?? 0;
    this.url = url ?? "";
    this.body = body ?? null;
  }
}

function withTimeout(signal, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(
    () => controller.abort(new DOMException("Timeout", "AbortError")),
    timeoutMs
  );

  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(id)
  };
}

async function parseBody(res) {
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) return await res.json();
    return await res.text();
  } catch {
    return null;
  }
}

async function request(
  path,
  {
    baseUrl = DEFAULT_BASE_URL,
    method = "GET",
    headers,
    json,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal
  } = {}
) {
  const bases = path.startsWith("http")
    ? [""]
    : Array.from(new Set([baseUrl, DEFAULT_BASE_URL, FALLBACK_BASE_URL].filter(Boolean)));

  let lastError = null;

  for (const base of bases) {
    const url = path.startsWith("http") ? path : `${base}${path}`;
    const { signal: timedSignal, cleanup } = withTimeout(signal, timeoutMs);

    const h = new Headers(headers || {});
    let finalBody = body;

    if (json !== undefined) {
      h.set("content-type", "application/json");
      finalBody = JSON.stringify(json);
    }

    try {
      const res = await fetch(url, {
        method,
        headers: h,
        body: finalBody,
        signal: timedSignal
      });

      const resBody = await parseBody(res);

      if (!res.ok) {
        const apiErr = new ApiError(
          resBody?.error ? `API error: ${resBody.error}` : `HTTP ${res.status}`,
          { status: res.status, url, body: resBody }
        );

        // When multiple backends are configured, try the next one before surfacing the error.
        if (!path.startsWith("http") && base !== bases[bases.length - 1]) {
          lastError = apiErr;
          continue;
        }

        throw apiErr;
      }

      return resBody;
    } catch (err) {
      if (err?.name === "AbortError") {
        lastError = new ApiError("Request timeout", { status: 0, url });
      } else if (err instanceof ApiError) {
        lastError = err;
      } else {
        lastError = new ApiError(err?.message || "Network error", { status: 0, url });
      }

      if (path.startsWith("http") || base === bases[bases.length - 1]) throw lastError;
    } finally {
      cleanup();
    }
  }

  throw lastError || new ApiError("Network error", { status: 0, url: String(path || "") });
}

// ---------------- ROTAS DO BACKEND ----------------

export function bindUser(boundUserKey, boundUserLabel) {
  return request("/api/auth/bind", {
    method: "POST",
    json: { boundUserKey, boundUserLabel }
  });
}

export function trialStatus(boundUserKey) {
  return request("/api/trial/status", {
    method: "POST",
    json: { boundUserKey }
  });
}

export function verifyLicense({
  boundUserKey,
  licenseKey,
  extensionId,
  deviceId
}) {
  const payload = { boundUserKey, licenseKey };
  if (extensionId) payload.extensionId = extensionId;
  if (deviceId) payload.deviceId = deviceId;

  return request("/api/license/verify", {
    method: "POST",
    json: payload
  });
}

export function buildBuyUrl({
  boundUserKey,
  plan = "pro",
  period = "monthly",
  baseUrl = DEFAULT_BASE_URL
}) {
  const u = new URL("/buy", baseUrl);
  u.searchParams.set("boundUserKey", boundUserKey);
  u.searchParams.set("plan", plan);
  u.searchParams.set("period", period);
  return u.toString();
}
