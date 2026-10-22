import { createDecipheriv } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ORG = "7ca2ee92-6b12-4f54-ba7b-986bab2f9434";
const CONN = "8cf2e98b-18f8-4a80-b73f-110b8d012d42";
const CRED = "3e9f5776-613f-49b6-9e46-c13cafc5e38e";
const WABA = "1639299021541980";
const PHONE = "1295394797000036";
const respond = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
export async function POST(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = process.env.META_CREDENTIAL_ENCRYPTION_KEY;
  if (!base || !pub || !service || !/^[a-f\d]{64}$/i.test(key || "") || !process.env.META_APP_ID || !process.env.META_APP_SECRET) return respond({ error: "Configuration unavailable" }, 503);
  if (request.headers.get("origin") !== new URL(request.url).origin) return respond({ error: "Origin mismatch" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return respond({ error: "JSON required" }, 415);
  const session = request.cookies.get("nexus_access_token")?.value;
  if (!session) return respond({ error: "Unauthorized" }, 401);
  const admin = { apikey: service, Authorization: `Bearer ${service}` };
  try {
    const identity = await fetch(`${base}/auth/v1/user`, { headers: { apikey: pub, Authorization: `Bearer ${session}` }, cache: "no-store" });
    if (!identity.ok) return respond({ error: "Unauthorized" }, 401);
    const user = await identity.json();
    if (!user?.id) return respond({ error: "Unauthorized" }, 401);
    const profileRes = await fetch(`${base}/rest/v1/nexus_user_profiles?select=profile,active,organization_id&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true`, { headers: admin, cache: "no-store" });
    if (!profileRes.ok) return respond({ error: "Authorization unavailable" }, 503);
    const profiles = await profileRes.json();
    if (!Array.isArray(profiles) || !profiles.some(p => p.profile === "NEXUS_ROOT" && p.active === true && p.organization_id === ORG)) return respond({ error: "Forbidden" }, 403);
    const payload = await request.json();
    if (payload?.confirm !== "ACTIVATE_META_CONNECTION_NO_SEND") return respond({ error: "Explicit confirmation required" }, 400);
    const [connRes, credRes] = await Promise.all([
      fetch(`${base}/rest/v1/nexus_meta_whatsapp_connections?select=id,organization_id,waba_id,phone_number_id,connection_status,credential_reference,connected_at&id=eq.${CONN}&organization_id=eq.${ORG}`, { headers: admin, cache: "no-store" }),
      fetch(`${base}/rest/v1/nexus_meta_oauth_credentials?select=id,organization_id,status,encrypted_token&id=eq.${CRED}&organization_id=eq.${ORG}`, { headers: admin, cache: "no-store" })
    ]);
    if (!connRes.ok || !credRes.ok) return respond({ error: "Database lookup unavailable" }, 503);
    const [connections, credentials] = await Promise.all([connRes.json(), credRes.json()]);
    const c = connections?.[0], credential = credentials?.[0];
    if (!c || !credential || c.waba_id !== WABA || c.phone_number_id !== PHONE || c.credential_reference !== CRED || c.connection_status !== "pending" || c.connected_at != null || credential.status !== "pending_verification") return respond({ error: "Activation preconditions not met" }, 409);
    const envelope = credential.encrypted_token;
    if (envelope?.algorithm !== "aes-256-gcm" || !["iv", "tag", "ciphertext"].every(k => typeof envelope[k] === "string")) return respond({ error: "Invalid encrypted credential" }, 422);
    let token;
    try {
      const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(envelope.iv, "base64"));
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      token = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8");
      if (!token || token.length > 16384) throw new Error("Bad token");
    } catch { return respond({ error: "Credential decryption failed" }, 422); }
    const meta = async (path, bearer) => {
      try {
        const r = await fetch(`https://graph.facebook.com/v26.0/${path}`, { headers: { Authorization: `Bearer ${bearer}` }, cache: "no-store", signal: AbortSignal.timeout(12000) });
        const data = await r.json().catch(() => ({}));
        return { ok: r.ok, data };
      } catch { return { ok: false, data: {} }; }
    };
    const debug = await meta(`debug_token?input_token=${encodeURIComponent(token)}`, `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`);
    if (!debug.ok || debug.data?.data?.is_valid !== true || String(debug.data?.data?.app_id) !== process.env.META_APP_ID || debug.data?.data?.type !== "SYSTEM_USER") return respond({ error: "Meta token validation failed" }, 422);
    const [waba, phone] = await Promise.all([meta(`${WABA}?fields=id`, token), meta(`${PHONE}?fields=id`, token)]);
    if (!waba.ok || String(waba.data?.id) !== WABA || !phone.ok || String(phone.data?.id) !== PHONE) return respond({ error: "Meta asset validation failed" }, 422);
    // This RPC is atomic, records an audit entry and never changes outbound sending settings.
    const rpc = await fetch(`${base}/rest/v1/rpc/nexus_meta_activate_connection`, { method: "POST", headers: { ...admin, "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ p_organization_id: ORG, p_connection_id: CONN, p_credential_id: CRED, p_activated_by: user.id }) });
    if (!rpc.ok) return respond({ error: "Atomic activation rejected; no partial activation" }, 409);
    const result = await rpc.json();
    return respond({ ...result, meta_revalidated: true, request_ok: true });
  } catch { return respond({ error: "Activation unavailable" }, 503); }
}
