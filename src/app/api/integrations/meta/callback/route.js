import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OAuth callback scaffold. It deliberately does not exchange authorization codes
// until tenant-bound initiation, credential storage, and Meta config are implemented.
function safeEqual(a, b) {
  const x = Buffer.from(a || "");
  const y = Buffer.from(b || "");
  return x.length === y.length && timingSafeEqual(x, y);
}

function validateState(state, secret) {
  if (!secret || !state || state.length > 2048) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [issuedAt, nonce, signature] = parts;
  if (!/^\d{10,13}$/.test(issuedAt) || !/^[a-zA-Z0-9_-]{16,128}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const time = Number(issuedAt);
  const timestampMs = issuedAt.length === 10 ? time * 1000 : time;
  if (!Number.isSafeInteger(timestampMs) || timestampMs > Date.now() + 60000 || Date.now() - timestampMs > 10 * 60 * 1000) return false;
  const expected = createHmac("sha256", secret).update(`${issuedAt}.${nonce}`).digest("hex");
  return safeEqual(signature, expected);
}

const reply = (message, status) => new Response(message, {
  status,
  headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
});

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  if (!validateState(state, process.env.META_OAUTH_STATE_SECRET)) {
    return reply("Solicitação de autorização inválida ou expirada.", 400);
  }
  if (params.has("error")) return reply("Autorização cancelada ou recusada. Retorne ao NEXUS.", 400);
  if (!params.get("code")) return reply("Código de autorização ausente.", 400);
  // Never log or display the code; no tenant can be connected until the
  // authenticated initiation and one-time state persistence are implemented.
  return reply("Integração Meta ainda não habilitada. Nenhuma conta foi conectada.", 503);
}
