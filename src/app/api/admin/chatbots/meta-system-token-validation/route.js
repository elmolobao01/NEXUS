export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ORG = "7ca2ee92-6b12-4f54-ba7b-986bab2f9434";
const WABA = "1639299021541980";
const PHONE = "1295394797000036";
const response = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache", "Referrer-Policy": "no-referrer" } });

// Controlled read-only validation. No token is stored, logged or echoed.
import { randomBytes, createCipheriv } from "node:crypto";
export async function POST(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !pub || !service) return response({ error: "Configuration unavailable" }, 503);
  const session = request.cookies.get("nexus_access_token")?.value;
  if (!session) return response({ error: "Unauthorized" }, 401);
  try {
    const identity = await fetch(`${base}/auth/v1/user`, { headers: { apikey: pub, Authorization: `Bearer ${session}` }, cache: "no-store" });
    if (!identity.ok) return response({ error: "Unauthorized" }, 401);
    const user = await identity.json();
    if (!user?.id) return response({ error: "Unauthorized" }, 401);
    const profilesResponse = await fetch(`${base}/rest/v1/nexus_user_profiles?select=profile,active,organization_id&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true`, { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: "no-store" });
    if (!profilesResponse.ok) return response({ error: "Authorization unavailable" }, 503);
    const profiles = await profilesResponse.json();
    if (!Array.isArray(profiles) || !profiles.some(p => p.profile === "NEXUS_ROOT" && p.active === true && p.organization_id === ORG)) return response({ error: "Forbidden" }, 403);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return response({ error: "JSON required" }, 415);
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 20000) return response({ error: "Payload too large" }, 413);
    const payload = await request.json();
    const token = payload?.access_token;
    if (typeof token !== "string" || token.length < 10 || token.length > 16384 || /[\s]/.test(token)) return response({ error: "Invalid token format" }, 400);
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) return response({ error: "Meta configuration unavailable" }, 503);
    const fetchGraph = async (path, authorization) => {
      try {
        const r = await fetch(`https://graph.facebook.com/v26.0/${path}`, { headers: { Authorization: `Bearer ${authorization}` }, cache: "no-store", signal: AbortSignal.timeout(12000) });
        const body = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, body };
      } catch { return { ok: false, status: null, body: {} }; }
    };
    const debug = await fetchGraph(`debug_token?input_token=${encodeURIComponent(token)}`, `${appId}|${appSecret}`);
    const data = debug.body?.data;
    const appMatches = debug.ok && String(data?.app_id || "") === appId;
    const valid = debug.ok && data?.is_valid === true && appMatches;
    // Do not probe assets if the supplied token is not a valid token for this app.
    if (!valid) return response({ valid: false, reason: "token_invalid_or_wrong_app", debug_http_status: debug.status, app_matches: appMatches, database_modified: false, sending_enabled: false });
    const [waba, phone] = await Promise.all([
      fetchGraph(`${WABA}?fields=id`, token),
      fetchGraph(`${PHONE}?fields=id`, token),
    ]);
    const wabaMatches = waba.ok && String(waba.body?.id || "") === WABA;
    const phoneMatches = phone.ok && String(phone.body?.id || "") === PHONE;
    const summarize = r => ({ ok: r.ok, http_status: r.status, meta_error_code: Number.isSafeInteger(r.body?.error?.code) ? r.body.error.code : null, meta_error_subcode: Number.isSafeInteger(r.body?.error?.error_subcode) ? r.body.error.error_subcode : null });
    if (payload?.import_credential === true) {
      if (!wabaMatches || !phoneMatches) return response({ valid: false, error: "Meta asset validation failed; nothing saved", database_modified: false, sending_enabled: false }, 422);
      if (request.headers.get("origin") !== new URL(request.url).origin) return response({ error: "Origin mismatch" }, 403);
      const keyHex = process.env.META_CREDENTIAL_ENCRYPTION_KEY;
      if (!/^[a-fA-F0-9]{64}$/.test(keyHex || "")) return response({ error: "Encryption unavailable" }, 503);
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
      const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
      const encrypted = { algorithm: "aes-256-gcm", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
      const rpc = await fetch(`${base}/rest/v1/rpc/nexus_meta_import_system_credential`, {
        method: "POST", cache: "no-store",
        headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_organization_id: ORG, p_connection_id: "8cf2e98b-18f8-4a80-b73f-110b8d012d42", p_initiated_by: user.id, p_encrypted_token: encrypted, p_token_type: "bearer" }),
      });
      if (!rpc.ok) return response({ valid: true, error: "Atomic import unavailable or connection already linked; no partial import", database_modified: false, sending_enabled: false }, 409);
      return response({ valid: true, credential_imported: true, credential_linked: true, credential_status: "pending_verification", connection_status: "pending", sending_enabled: false });
    }
    return response({ valid: wabaMatches && phoneMatches, app_matches: appMatches, token_type: typeof data?.type === "string" ? data.type.slice(0, 32) : null, waba: { ...summarize(waba), id_matches: wabaMatches }, phone: { ...summarize(phone), id_matches: phoneMatches }, database_modified: false, credential_imported: false, sending_enabled: false });
  } catch { return response({ error: "Validation unavailable" }, 503); }
}
