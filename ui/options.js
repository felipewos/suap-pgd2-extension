// ui/options.js
const $ = (id) => document.getElementById(id);

function fmtDate(ms){
  if(!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleString("pt-BR");
}

function computeValidity(access){
  if(!access) return "—";
  if(access.status === "paid_active" && access.licenseEndsAtMs) {
    return "Licença até: " + fmtDate(access.licenseEndsAtMs);
  }
  if(access.status === "trial_active" && access.trialEndsAtMs) {
    return "Trial até: " + fmtDate(access.trialEndsAtMs);
  }
  if(access.trialEndsAtMs) {
    return "Trial expirou em: " + fmtDate(access.trialEndsAtMs);
  }
  return "—";
}

function prettyStatus(access){
  const s = access?.status || "—";
  if(s === "trial_active") return "Trial ativo";
  if(s === "paid_active") return "Pago ativo";
  if(s === "expired_or_inactive") return "Expirado/Inativo";
  return s;
}

function prettyPlan(access){
  const p = access?.plan || "—";
  if(p === "basic") return "Básico";
  if(p === "pro") return "Pro";
  return p;
}

async function send(msg){
  return await chrome.runtime.sendMessage(msg);
}

async function refresh(){
  const st = await send({ type: "GET_STATE" });
  if(!st?.ok) return;

  $("boundUser").textContent = st.boundUserLabel || "—";
  $("status").textContent = prettyStatus(st.access);
  $("plan").textContent = prettyPlan(st.access);
  $("validity").textContent = computeValidity(st.access);

  $("licenseKey").value = st.licenseKey || "";
}

document.addEventListener("DOMContentLoaded", async () => {
  await refresh();

  $("btnVerify")?.addEventListener("click", async () => {
    const r = await send({ type: "FORCE_VERIFY" });
    if(!r?.ok) alert("Falha ao verificar: " + (r?.error || "erro"));
    await refresh();
  });

  $("btnActivate")?.addEventListener("click", async () => {
    const key = ($("licenseKey")?.value || "").trim();
    if(!key) return alert("Informe a chave.");

    const r = await send({ type: "SET_LICENSE_KEY", licenseKey: key });
    if(!r?.ok) return alert("Falha ao ativar: " + (r?.error || "erro"));

    alert("Ativado para este usuário.");
    await refresh();
  });

  $("btnClear")?.addEventListener("click", async () => {
    if(!confirm("Remover a chave de licença salva para este usuário?")) return;
    await send({ type: "CLEAR_LICENSE_KEY" });
    await refresh();
  });
});
