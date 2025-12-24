// ui/popup.js
const $ = (id) => document.getElementById(id);

function fmtDate(ms){
  if(!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleString("pt-BR");
}

function computeValidity(access){
  if(!access) return "—";
  if(access.status === "paid_active" && access.licenseEndsAtMs) return "Licença até: " + fmtDate(access.licenseEndsAtMs);
  if(access.status === "trial_active" && access.trialEndsAtMs) return "Trial até: " + fmtDate(access.trialEndsAtMs);
  if(access.trialEndsAtMs) return "Trial expirou em: " + fmtDate(access.trialEndsAtMs);
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
  const st = await send({type:"GET_STATE"});
  if(!st.ok) return;

  $("boundUser").textContent = st.boundUserLabel || "—";
  $("status").textContent = prettyStatus(st.access);
  $("plan").textContent = prettyPlan(st.access);
  $("validity").textContent = computeValidity(st.access);

  $("licenseKey").value = st.licenseKey || "";

  // Servidor FIXO em produção (não configurável pelo usuário)
  $("licenseHint").textContent = "Servidor: https://api.proffelipewagner.com.br";
}

document.addEventListener("DOMContentLoaded", async () => {
  await refresh();

  $("btnVerify").addEventListener("click", async () => {
    $("btnVerify").disabled = true;
    const r = await send({type:"FORCE_VERIFY"});
    $("btnVerify").disabled = false;
    if(!r.ok) alert("Falha ao verificar: " + (r.error || "erro"));
    await refresh();
  });

  $("btnOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());

  $("btnActivate").addEventListener("click", async () => {
    const key = $("licenseKey").value.trim();
    if(!key) return alert("Informe a chave de licença.");
    const r = await send({type:"SET_LICENSE_KEY", licenseKey: key});
    if(!r.ok) return alert("Falha ao ativar: " + (r.error || "erro"));
    await refresh();
  });

  $("btnClear").addEventListener("click", async () => {
    if(!confirm("Remover a chave de licença salva?")) return;
    await send({type:"CLEAR_LICENSE_KEY"});
    await refresh();
  });

  $("btnBuy").addEventListener("click", async () => {
    const st = await send({type:"GET_STATE"});
    if(!st.ok) return;
    if(!st.boundUserKey){
      alert("Abra o SUAP (PGD2) para detectar o usuário antes de comprar.");
      return;
    }

    // Compra via backend fixo
    const base = "https://api.proffelipewagner.com.br";
    const url = base.replace(/\/+$/,"") +
      `/buy?boundUserKey=${encodeURIComponent(st.boundUserKey)}&extensionId=${encodeURIComponent(st.extensionId || "")}`;

    window.open(url, "_blank");
  });
});
