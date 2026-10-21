import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (message, status) => new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
function validState(state, secret) {
  if (!secret || !state || state.length > 2048) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [issuedAt, nonce, signature] = parts;
  if (!/^\d{10}$/.test(issuedAt) || !/^[a-zA-Z0-9_-]{16,128}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const ts = Number(issuedAt) * 1000;
  if (!Number.isSafeInteger(ts) || ts > Date.now() + 60000 || Date.now() - ts > 600000) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${issuedAt}.${nonce}`).digest("hex"), "hex");
  const supplied = Buffer.from(signature, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  if (!validState(state, process.env.META_OAUTH_STATE_SECRET)) return reply("Solicitação inválida ou expirada.", 400);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return reply("Integração não configurada.", 503);
  const digest = createHash("sha256").update(state).digest("hex");
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
  try {
    // Atomic conditional update prevents a second callback from reusing a state.
    const update = await fetch(`${url}/rest/v1/nexus_meta_oauth_sessions?state_digest=eq.${digest}&status=eq.pending&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id`, { method: "PATCH", headers, body: JSON.stringify({ status: params.has("error") ? "cancelled" : "consumed", consumed_at: new Date().toISOString() }), cache: "no-store" });
    if (!update.ok) return reply("Falha ao validar sessão de autorização.", 503);
    const rows = await update.json();
    if (!Array.isArray(rows) || rows.length !== 1) return reply("Autorização já utilizada, inexistente ou expirada.", 400);
    if (params.has("error")) return reply("Autorização cancelada. Retorne ao NEXUS.", 400);
    if (!params.get("code")) return reply("Código de autorização ausente.", 400);
    // Deliberately do not exchange or persist tokens until Meta signup flow,
    // credential encryption, and tenant ownership are verified end-to-end.
    return reply("Retorno recebido e sessão encerrada. Conexão ainda não ativada.", 503);
  } catch { return reply("Falha ao validar autorização.", 500); }
}
