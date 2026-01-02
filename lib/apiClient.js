// apiClient.js (ESM)
// Uso: import { bindUser, trialStatus, verifyLicense, buildBuyUrl } from "./apiClient.js";

const DEFAULT_BASE_URL = "https://api.proffelipewagner.com.br";
const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, { status, url, body, headers } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status ?? 0;
    this.url = url ?? "";
    this.body = body;
    this.headers = headers ?? null;
  }
}

function withTimeout(signal, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException("Timeout", "AbortError")),
    timeoutMs
  );

  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }

  return { signal: controller.signal, cleanup: () => clearTimeout(timeoutId) };
}

async function parseBody(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try { return await res.json(); } catch { return null; }
  }
  try { return await res.text(); } catch { return null; }
}

async function request(path, {
  baseUrl = DEFAULT_BASE_URL,
  method = "GET",
  headers,
  json,
  body,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal
} = {}) {
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const { signal: timedSignal, cleanup } = withTimeout(signal, timeoutMs);

  const finalHeaders = new Headers(headers || {});
  if (json !== undefined) finalHeaders.set("content-type", "application/json");

  let finalBody = body;
  if (json !== undefined) finalBody = JSON.stringify(json);

  try {
    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: finalBody,
      signal: timedSignal
    });

    const resBody = await parseBody(res);

    if (!res.ok) {
      throw new ApiError(
        (resBody && resBody.error) ? `API error: ${resBody.error}` : `HTTP ${res.status}`,
        { status: res.status, url, body: resBody, headers: res.headers }
      );
    }

    return resBody;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new ApiError("Request timeout", { status: 0, url });
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(err?.message || "Network error", { status: 0, url });
  } finally {
    cleanup();
  }
}

// --------- ROTAS DO BACKEND ---------

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

export function verifyLicense({ boundUserKey, licenseKey, extensionId, deviceId }) {
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

export function makeClient(baseUrl) {
  return {
    bindUser: (k, l) =>
      request("/api/auth/bind", {
        method: "POST",
        json: { boundUserKey: k, boundUserLabel: l },
        baseUrl
      }),
    trialStatus: (k) =>
      request("/api/trial/status", {
        method: "POST",
        json: { boundUserKey: k },
        baseUrl
      }),
    verifyLicense: (args) =>
      request("/api/license/verify", {
        method: "POST",
        json: args,
        baseUrl
      }),
    buildBuyUrl: (args) => buildBuyUrl({ ...args, baseUrl })
  };
}
