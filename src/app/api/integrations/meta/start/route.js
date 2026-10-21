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
    // Resolve the user's active organization memberships server-side.
    // Never accept organization_id or profile from the request body.
    const profiles = await fetch(`${url}/rest/v1/nexus_user_profiles?select=organization_id,profile,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true`, { headers: userHeaders, cache: "no-store" });
    if (!profiles.ok) return json("Não foi possível verificar o perfil.", 503);
    const memberships = await profiles.json();
    if (!Array.isArray(memberships)) return json("Resposta de perfis inválida.", 503);
    const eligible = memberships.filter((item) =>
      item?.organization_id && ["MANAGER", "CLIENT_ADMIN", "NEXUS_ROOT"].includes(item.profile)
    );
    if (eligible.length === 0) return json("Seu perfil não permite iniciar esta integração.", 403);
    // Fail closed on ambiguous membership. ROOT global access requires a separate,
    // audited target-organization authorization flow; never infer it from ROOT.
    const organizations = [...new Set(eligible.map((item) => item.organization_id))];
    if (organizations.length !== 1) return json("Há mais de uma organização autorizada. Selecione a organização em um fluxo específico.", 409);
    const organizationId = organizations[0];
    const org = await fetch(`${url}/rest/v1/nexus_organizations?select=id,status&id=eq.${encodeURIComponent(organizationId)}&limit=1`, { headers: userHeaders, cache: "no-store" });
    if (!org.ok) return json("Não foi possível validar a organização.", 503);
    const organization = (await org.json())?.[0];
    if (!organization || organization.status !== "active") return json("Organização inexistente ou inativa.", 403);
    const issuedAt = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(32).toString("base64url");
    const payload = `${issuedAt}.${nonce}`;
    const state = `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
    const stateDigest = createHash("sha256").update(state).digest("hex");
    const adminHeaders = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json", Prefer: "return=minimal" };
    const saved = await fetch(`${url}/rest/v1/nexus_meta_oauth_sessions`, { method: "POST", headers: adminHeaders, cache: "no-store", body: JSON.stringify({ organization_id: organizationId, initiated_by: user.id, state_digest: stateDigest, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() }) });
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
    const enabled = process.env.META_OAUTH_CONTROLLED_TEST_ENABLED === "true";
    return Response.json({
      // Return the one-time URL only when explicitly enabled by server configuration.
      ...(enabled ? { authorization_url: authorization.toString() } : {}),
      status: enabled ? "controlled_test_ready" : "prepared_not_enabled",
    }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return json("Não foi possível iniciar a autorização.", 500); }
}
