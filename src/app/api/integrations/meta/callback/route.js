import { createHmac, createHash, timingSafeEqual, randomBytes, createCipheriv } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const redirectUri = "https://portal.pleniumgestao.com.br/api/integrations/meta/callback";
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
function encryptionKey() {
  const encoded = process.env.META_CREDENTIAL_ENCRYPTION_KEY;
  if (!encoded || !/^[a-fA-F0-9]{64}$/.test(encoded)) return null;
  return Buffer.from(encoded, "hex");
}
function encrypt(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64"), algorithm: "aes-256-gcm" };
}
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  if (!validState(state, process.env.META_OAUTH_STATE_SECRET)) return reply("Solicitação inválida ou expirada.", 400);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const vaultKey = encryptionKey();
  // Do not consume OAuth state unless durable, encrypted storage is configured.
  // Report only configuration *names*, never their values, and only after a
  // correctly signed, unexpired OAuth state has been presented.
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !key && "SUPABASE_SERVICE_ROLE_KEY",
    !appId && "META_APP_ID",
    !appSecret && "META_APP_SECRET",
    !vaultKey && "META_CREDENTIAL_ENCRYPTION_KEY (64 caracteres hexadecimais)",
  ].filter(Boolean);
  if (missing.length) {
    return reply(`Configuração OAuth incompleta ou inválida: ${missing.join(", ")}. Verifique o ambiente Production na Vercel.`, 503);
  }
  const digest = createHash("sha256").update(state).digest("hex");
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
  try {
    // Conditional PATCH claims this one-time state before any exchange.
    const update = await fetch(`${url}/rest/v1/nexus_meta_oauth_sessions?state_digest=eq.${digest}&status=eq.pending&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,organization_id,initiated_by`, {
      method: "PATCH", headers, body: JSON.stringify({ status: params.has("error") ? "cancelled" : "consumed", consumed_at: new Date().toISOString() }), cache: "no-store"
    });
    if (!update.ok) return reply("Falha ao validar sessão de autorização.", 503);
    const rows = await update.json();
    if (!Array.isArray(rows) || rows.length !== 1) return reply("Autorização já utilizada, inexistente ou expirada.", 400);
    if (params.has("error")) return reply("Autorização cancelada. Retorne ao NEXUS.", 400);
    const code = params.get("code");
    if (!code || code.length > 4096) return reply("Código de autorização ausente ou inválido.", 400);
    const tokenUrl = new URL("https://graph.facebook.com/v26.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const exchange = await fetch(tokenUrl, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!exchange.ok) {
      // Do not log the request URL, OAuth code, state, access tokens or Meta error messages.
      // Meta messages may contain identifiers; only numeric codes and a bounded type are safe.
      let details = {};
      try {
        const body = await exchange.json();
        const err = body && typeof body === "object" ? body.error : null;
        if (err && typeof err === "object") {
          if (Number.isSafeInteger(err.code)) details.code = err.code;
          if (Number.isSafeInteger(err.error_subcode)) details.subcode = err.error_subcode;
          if (typeof err.type === "string" && /^[A-Za-z_]{1,64}$/.test(err.type)) details.type = err.type;
        }
      } catch { /* Response may not be JSON. */ }
      console.error("meta_oauth_exchange_failed", { http_status: exchange.status, ...details });
      return reply("A Meta recusou a troca do código OAuth. Consulte o evento meta_oauth_exchange_failed nos logs da Vercel. Não reutilize esta autorização.", 502);
    }
    const token = await exchange.json();
    if (typeof token?.access_token !== "string" || !token.access_token || token.access_token.length > 16384) return reply("A Meta não retornou uma credencial válida.", 502);
    // Store encrypted credential as PENDING: WABA, phone ownership and embedded signup
    // completion still need independent validation before activation.
    const encrypted = encrypt(token.access_token, vaultKey);
    const stored = await fetch(`${url}/rest/v1/nexus_meta_oauth_credentials`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" }, cache: "no-store",
      body: JSON.stringify({ oauth_session_id: rows[0].id, organization_id: rows[0].organization_id, initiated_by: rows[0].initiated_by, encrypted_token: encrypted, token_type: typeof token.token_type === "string" ? token.token_type.slice(0, 50) : null, expires_in_seconds: Number.isSafeInteger(token.expires_in) && token.expires_in >= 0 ? token.expires_in : null, status: "pending_verification" })
    });
    if (!stored.ok) return reply("Autorização recebida, mas não foi possível armazenar a credencial com segurança. Reinicie o processo.", 503);
    return reply("Autorização recebida com segurança. Conexão ainda pendente de validação da conta WhatsApp.", 200);
  } catch {
    return reply("Não foi possível concluir a autorização. Reinicie o processo.", 503);
  }
}
