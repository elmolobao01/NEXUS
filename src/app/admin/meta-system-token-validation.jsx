"use client";
import { useState } from "react";
export default function MetaSystemTokenValidation() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  async function validate(event) {
    event.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true); setResult(null);
    try {
      const res = await fetch("/api/admin/chatbots/meta-system-token-validation", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: token.trim() }) });
      const body = await res.json();
      setResult({ ...body, request_ok: res.ok });
    } catch { setResult({ error: "Falha ao verificar a credencial." }); }
    finally { setToken(""); setBusy(false); }
  }
  return <section style={{ padding: 16, marginTop: 16, border: "1px solid #dce5f2", borderRadius: 10 }}>
    <h4>Validar token de usuário de sistema (sem importar)</h4>
    <p>Teste restrito ao ROOT. O token será enviado por HTTPS ao servidor, consultado na Meta e descartado após o teste. Não será armazenado no NEXUS.</p>
    <form onSubmit={validate} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input type="password" autoComplete="off" spellCheck="false" aria-label="Token Meta" placeholder="Cole o token gerado na Meta" value={token} onChange={e => setToken(e.target.value)} style={{ minWidth: 320, flex: 1 }} />
      <button type="submit" disabled={busy || !token.trim()}>{busy ? "Validando..." : "Validar token sem salvar"}</button>
    </form>
    {result && <div role="status" style={{ marginTop: 12 }}><strong>{result.valid ? "Token validado para WABA e número oficial" : "Token ainda não validado"}</strong><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(result, null, 2)}</pre></div>}
  </section>;
}
