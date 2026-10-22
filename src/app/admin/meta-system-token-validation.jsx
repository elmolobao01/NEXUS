"use client";
import { useState } from "react";
export default function MetaSystemTokenValidation() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  async function validate(event, importCredential = false) {
    event.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true); setResult(null);
    try {
      const res = await fetch("/api/admin/chatbots/meta-system-token-validation", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: token.trim(), import_credential: importCredential }) });
      const body = await res.json();
      setResult({ ...body, request_ok: res.ok });
    } catch { setResult({ error: "Falha ao verificar a credencial." }); }
    finally { setToken(""); setBusy(false); }
  }
  return <section style={{ padding: 16, marginTop: 16, border: "1px solid #dce5f2", borderRadius: 10 }}>
    <h4>Validar token de usuário de sistema (sem importar)</h4>
    <p>Teste restrito ao ROOT. O token será enviado por HTTPS ao servidor, consultado na Meta e descartado após o teste. O botão de validação não armazena o token. O botão de importação criptografa e vincula a credencial após nova validação; o envio permanece desativado.</p>
    <form onSubmit={e => validate(e, false)} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input type="password" autoComplete="off" spellCheck="false" aria-label="Token Meta" placeholder="Cole o token gerado na Meta" value={token} onChange={e => setToken(e.target.value)} style={{ minWidth: 320, flex: 1 }} />
      <button type="submit" disabled={busy || !token.trim()}>{busy ? "Processando..." : "Validar token sem salvar"}</button>
      <button type="button" disabled={busy || !token.trim()} onClick={e => { if (window.confirm("Importar e vincular este token? A conexão continuará pendente e o envio automático desativado.")) validate(e, true); }}>Validar, importar e vincular (ROOT)</button>
    </form>
    {result && <div role="status" style={{ marginTop: 12 }}><strong>{result.valid ? (result.credential_imported ? "Credencial importada e vinculada; envio desativado" : "Token validado para WABA e número oficial") : "Token ainda não validado"}</strong><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(result, null, 2)}</pre></div>}
  </section>;
}
