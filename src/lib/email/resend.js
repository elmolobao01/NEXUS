const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function portalBase() {
  return (process.env.PLENIUM_PORTAL_URL || "https://portal.pleniumgestao.com.br").replace(/\/$/, "");
}

export async function sendPleniumEmail({ to, subject, heading, message, link, button }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não configurada.");
  const safe = (value) => String(value || "").replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
  const html = `<div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#10243e;padding:28px"><img src="https://www.pleniumgestao.com.br/branding/plenium-brand-horizontal.png" alt="PLENIUM" width="190"/><h1 style="font-size:25px">${safe(heading)}</h1><p style="line-height:1.7">${safe(message)}</p><p style="margin:30px 0"><a href="${safe(link)}" style="background:#205cf2;color:#fff;padding:14px 22px;border-radius:9px;text-decoration:none;font-weight:bold">${safe(button)}</a></p><p style="font-size:13px;color:#52657c">Se você não solicitou este acesso, ignore esta mensagem. Nunca compartilhe o link.</p><p style="font-size:12px;overflow-wrap:anywhere">Se o botão não funcionar, copie este endereço: ${safe(link)}</p></div>`;
  const response = await fetch(RESEND_ENDPOINT, {method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.PLENIUM_EMAIL_FROM || "PLENIUM <convites@pleniumgestao.com.br>",to:[to],subject,html}),cache:"no-store"});
  if (!response.ok) { const data = await response.json().catch(()=>({})); throw new Error(data?.message || `Falha no envio de e-mail (${response.status}).`); }
  return response.json();
}
