// ui/options.js
const $ = (id) => document.getElementById(id);

async function send(msg) {
  return await chrome.runtime.sendMessage(msg);
}

async function refresh() {
  const st = await send({ type: "GET_STATE" });
  if (!st?.ok) return;

  if ($("licenseKey")) $("licenseKey").value = st.licenseKey || "";

  if ($("serverHint")) {
    $("serverHint").textContent =
      "Servidor: https://api.proffelipewagner.com.br (com fallback Cloudflare ativo).";
  }

  if (!st.boundUserKey && $("serverHint")) {
    $("serverHint").textContent =
      "Servidor: https://api.proffelipewagner.com.br (com fallback Cloudflare ativo) - Abra o SUAP (PGD2) para detectar o usuario antes de ativar.";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await refresh();

  $("btnActivate")?.addEventListener("click", async () => {
    const key = ($("licenseKey")?.value || "").trim();
    if (!key) return alert("Informe a chave de licenca.");

    const r = await send({ type: "SET_LICENSE_KEY", licenseKey: key });
    if (!r?.ok) return alert("Falha ao ativar: " + (r?.error || "erro"));

    alert("Licenca salva/ativada para o usuario atual.");
    await refresh();
  });

  $("btnClear")?.addEventListener("click", async () => {
    if (!confirm("Remover a chave de licenca salva para este usuario?")) return;

    const r = await send({ type: "CLEAR_LICENSE_KEY" });
    if (!r?.ok) alert("Falha ao limpar: " + (r?.error || "erro"));

    await refresh();
  });
});

