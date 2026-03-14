// ui/popup.js
const $ = (id) => document.getElementById(id);
const BUY_BASE_URL = "https://suap-pgd2-license-backend.felipewagner83.workers.dev";

function fmtDate(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleString("pt-BR");
}

function computeValidity(access) {
  if (!access) return "";
  if (access.status === "paid_active" && access.licenseEndsAtMs) return "Licença até: " + fmtDate(access.licenseEndsAtMs);
  if (access.status === "trial_active" && access.trialEndsAtMs) return "Trial até: " + fmtDate(access.trialEndsAtMs);
  if (access.trialEndsAtMs) return "Trial expirou em: " + fmtDate(access.trialEndsAtMs);
  return "";
}

function prettyStatus(access) {
  const s = access?.status || "";
  if (s === "trial_active") return "Trial ativo";
  if (s === "paid_active") return "Pago ativo";
  if (s === "expired_or_inactive") return "Expirado/Inativo";
  return s;
}

async function send(msg) {
  return await chrome.runtime.sendMessage(msg);
}

async function refresh() {
  const st = await send({ type: "GET_STATE" });
  if (!st?.ok) return;

  $("boundUser").textContent = st.boundUserLabel || "";
  $("status").textContent = prettyStatus(st.access);
  $("validity").textContent = computeValidity(st.access);
  return st;
}

async function openBuy(plan, period) {
  const st = await send({ type: "GET_STATE" });
  if (!st?.ok) return;

  if (!st.boundUserKey) {
    alert("Abra o SUAP (PGD2) para detectar o usuário antes de comprar.");
    return;
  }

  const base = BUY_BASE_URL;
  const url =
    base.replace(/\/+$/, "") +
    `/buy?boundUserKey=${encodeURIComponent(st.boundUserKey)}` +
    `&plan=${encodeURIComponent(plan)}` +
    `&period=${encodeURIComponent(period)}`;

  window.open(url, "_blank");
}

document.addEventListener("DOMContentLoaded", async () => {
  const st = await refresh();

  if (st?.boundUserKey) {
    const r = await send({ type: "FORCE_VERIFY" });
    if (r?.ok) await refresh();
  }

  $("btnVerify")?.addEventListener("click", async () => {
    $("btnVerify").disabled = true;
    const r = await send({ type: "FORCE_VERIFY" });
    $("btnVerify").disabled = false;
    if (!r?.ok) alert("Falha ao verificar: " + (r?.error || "erro"));
    await refresh();
  });

  $("btnOptions")?.addEventListener("click", () => chrome.runtime.openOptionsPage());

  $("btnBuyProMonthly")?.addEventListener("click", () => openBuy("pro", "monthly"));
  $("btnBuyProYearly")?.addEventListener("click", () => openBuy("pro", "yearly"));
});
