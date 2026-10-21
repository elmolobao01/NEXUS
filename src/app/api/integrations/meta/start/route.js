import { randomBytes, createHmac, createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (message, status) => Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.META_OAUTH_STATE_SECRET;
  const appId = process.env.META_APP_ID;
  const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID;
  if (![url, anon, service, secret, appId, configId].every(Boolean)) return json("Integração Meta ainda não configurada.", 503);
  const bearer = request.cookies.get("nexus_access_token")?.value;
  if (!bearer) return json("Faça login no NEXUS.", 401);
  const userHeaders = { apikey: anon, Authorization: `Bearer ${bearer}` };
  try {
    const auth = await fetch(`${url}/auth/v1/user`, { headers: userHeaders, cache: "no-store" });
    if (!auth.ok) return json("Sessão inválida.", 401);
    const user = await auth.json();
    if (!user.id) return json("Sessão inválida.", 401);
    const profiles = await fetch(`${url}/rest/v1/nexus_user_profiles?select=organization_id,profile,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`, { headers: userHeaders, cache: "no-store" });
    if (!profiles.ok) return json("Não foi possível verificar o perfil.", 503);
    const profile = (await profiles.json())?.[0];
    if (!profile?.organization_id || profile.profile !== "MANAGER") return json("Somente o gestor da organização pode iniciar esta integração.", 403);
    const issuedAt = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(32).toString("base64url");
    const payload = `${issuedAt}.${nonce}`;
    const state = `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
    const stateDigest = createHash("sha256").update(state).digest("hex");
    const adminHeaders = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json", Prefer: "return=minimal" };
    const saved = await fetch(`${url}/rest/v1/nexus_meta_oauth_sessions`, { method: "POST", headers: adminHeaders, cache: "no-store", body: JSON.stringify({ organization_id: profile.organization_id, initiated_by: user.id, state_digest: stateDigest, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() }) });
    if (!saved.ok) return json("Não foi possível registrar a autorização.", 503);
    // This URL is an authorization preparation only. It must be tested against
    // the actual Meta Embedded Signup configuration before customer use.
    const redirectUri = "https://portal.pleniumgestao.com.br/api/integrations/meta/callback";
    const authorization = new URL("https://www.facebook.com/v26.0/dialog/oauth");
    authorization.searchParams.set("client_id", appId);
    authorization.searchParams.set("redirect_uri", redirectUri);
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("config_id", configId);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("override_default_response_type", "true");
    return Response.json({ authorization_url: authorization.toString(), status: "prepared_not_enabled" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return json("Não foi possível iniciar a autorização.", 500); }
}
