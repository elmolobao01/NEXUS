"use client";

import { useEffect, useState } from "react";

export default function SetPasswordClient() {
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("access_token") || "";
    const type = hash.get("type") || "";
    setAccessToken(token);
    if (!token) setMessage("O convite é inválido ou expirou. Solicite um novo convite ao administrador.");
    else if (type && !["invite", "recovery", "signup"].includes(type)) setMessage("Este link não pode ser usado para definir uma senha.");
    setReady(true);
  }, []);

  async function submit(event) {
    event.preventDefault(); setMessage("");
    if (password.length < 8) { setMessage("A senha deve possuir pelo menos 8 caracteres."); return; }
    if (password !== confirm) { setMessage("As senhas informadas não coincidem."); return; }
    setSaving(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key || !accessToken) throw new Error("Não foi possível validar o convite.");
      const response = await fetch(`${url}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.msg || data?.message || "Não foi possível definir a senha.");
      await fetch(`${url}/auth/v1/logout`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${accessToken}` } }).catch(() => {});
      setMessage("Senha definida com sucesso. Redirecionando para o login…");
      window.setTimeout(() => { window.location.href = "/login"; }, 900);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao definir a senha."); }
    finally { setSaving(false); }
  }

  return <main className="nexus-activation-page"><section className="nexus-activation-card"><div className="nexus-activation-mark">NX</div><span className="eyebrow">ATIVAÇÃO DE ACESSO</span><h1>Defina sua senha NEXUS</h1><p>Seu administrador já configurou a organização, o perfil e as permissões iniciais. Crie sua senha para concluir a ativação.</p>{ready && accessToken ? <form onSubmit={submit}><label><span>Nova senha</span><input type="password" minLength="8" required value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="new-password"/></label><label><span>Confirmar senha</span><input type="password" minLength="8" required value={confirm} onChange={(e)=>setConfirm(e.target.value)} autoComplete="new-password"/></label><button className="primary-button" disabled={saving}>{saving ? "Ativando…" : "Ativar meu acesso"}</button></form> : null}{message ? <div className="client-feedback">{message}</div> : null}<small>O NEXUS identificará automaticamente seu ambiente após o login.</small></section></main>;
}
