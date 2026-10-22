import { createDecipheriv } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ORGANIZATION_ID = "7ca2ee92-6b12-4f54-ba7b-986bab2f9434";
const respond = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
const rest = (base, table, query) => `${base}/rest/v1/${table}?${query}`;

export async function GET(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptedKey = process.env.META_CREDENTIAL_ENCRYPTION_KEY;
  const sessionToken = request.cookies.get("nexus_access_token")?.value;
  if (!base || !pub || !service || !/^[a-fA-F0-9]{64}$/.test(encryptedKey || "")) return respond({ error: "Configuration unavailable" }, 503);
  if (!sessionToken) return respond({ error: "Unauthorized" }, 401);
  const serviceHeaders = { apikey: service, Authorization: `Bearer ${service}` };
  try {
    const identity = await fetch(`${base}/auth/v1/user`, { headers: { apikey: pub, Authorization: `Bearer ${sessionToken}` }, cache: "no-store" });
    if (!identity.ok) return respond({ error: "Unauthorized" }, 401);
    const user = await identity.json();
    if (!user?.id) return respond({ error: "Unauthorized" }, 401);
    const profileResponse = await fetch(rest(base, "nexus_user_profiles", `select=profile,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true`), { headers: serviceHeaders, cache: "no-store" });
    if (!profileResponse.ok) return respond({ error: "Authorization unavailable" }, 503);
    const profiles = await profileResponse.json();
    if (!Array.isArray(profiles) || !profiles.some((p) => p.profile === "NEXUS_ROOT" && p.active === true)) return respond({ error: "Forbidden" }, 403);

    const org = encodeURIComponent(ORGANIZATION_ID);
    const [credentialsResponse, connectionsResponse] = await Promise.all([
      fetch(rest(base, "nexus_meta_oauth_credentials", `select=id,encrypted_token,status,created_at&organization_id=eq.${org}&order=created_at.desc&limit=10`), { headers: serviceHeaders, cache: "no-store" }),
      fetch(rest(base, "nexus_meta_whatsapp_connections", `select=id,waba_id,phone_number_id,credential_reference,connection_status&organization_id=eq.${org}&limit=10`), { headers: serviceHeaders, cache: "no-store" }),
    ]);
    if (!credentialsResponse.ok || !connectionsResponse.ok) return respond({ error: "Database lookup unavailable" }, 503);
    const credentials = await credentialsResponse.json();
    const connections = await connectionsResponse.json();
    if (!Array.isArray(credentials) || !Array.isArray(connections)) return respond({ error: "Unexpected database response" }, 503);
    const credential = credentials.find((c) => c.status === "pending_verification");
    const connection = connections.find((c) => c.phone_number_id && c.waba_id);
    if (!credential || !connection) return respond({ valid: false, reason: "credential_or_connection_missing", sending_enabled: false });

    let accessToken;
    try {
      const envelope = credential.encrypted_token;
      if (envelope?.algorithm !== "aes-256-gcm" || !["iv", "tag", "ciphertext"].every((key) => typeof envelope[key] === "string")) throw new Error("Invalid envelope");
      const decipher = createDecipheriv("aes-256-gcm", Buffer.from(encryptedKey, "hex"), Buffer.from(envelope.iv, "base64"));
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      accessToken = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8");
      if (!accessToken || accessToken.length > 16384) throw new Error("Invalid token");
    } catch {
      return respond({ valid: false, reason: "decryption_failed", sending_enabled: false });
    }

    const phoneId = connection.phone_number_id;
    if (!/^\d{1,30}$/.test(phoneId) || !/^\d{1,30}$/.test(connection.waba_id)) return respond({ valid: false, reason: "invalid_connection_identifiers", sending_enabled: false });
    // Separate token identity, granted scopes, resource access, and field access.
    // Never return raw Meta messages, tokens, user IDs, or business identifiers.
    const graph = async (path) => {
      try {
        const r = await fetch(`https://graph.facebook.com/v26.0/${path}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store", signal: AbortSignal.timeout(12000),
        });
        const data = await r.json().catch(() => ({}));
        return { ok: r.ok, http_status: r.status, data };
      } catch { return { ok: false, http_status: null, data: {}, network_error: true }; }
    };
    const summarize = (r) => {
      const e = r.data?.error;
      const msg = typeof e?.message === "string" ? e.message.toLowerCase() : "";
      let cause = "unknown_meta_error";
      if (r.network_error) cause = "network_error";
      else if (r.ok) cause = "ok";
      else if (e?.code === 190 || /invalid access token|error validating access token|session has expired/.test(msg)) cause = "invalid_expired_or_revoked_token";
      else if (/permission|not authorized|not authorised|does not have access|access to this resource/.test(msg) || e?.code === 200) cause = "permissions_or_asset_access";
      else if (/nonexisting field|nonexistent field|unknown field|invalid field/.test(msg)) cause = "field_not_supported";
      else if (/unsupported get request|does not exist|cannot be loaded/.test(msg)) cause = "resource_not_accessible";
      else if (e?.code === 100) cause = "invalid_parameter_or_resource";
      return { ok: r.ok, http_status: r.http_status, meta_error_code: Number.isSafeInteger(e?.code) ? e.code : null, meta_error_subcode: Number.isSafeInteger(e?.error_subcode) ? e.error_subcode : null, cause };
    };
    const metaIdentity = await graph("me?fields=id");
    // Do not request permissions when the token cannot even identify its subject.
    const permissions = metaIdentity.ok ? await graph("me/permissions?limit=100") : null;
    const barePhone = metaIdentity.ok ? await graph(`${phoneId}?fields=id`) : null;
    const phoneDetails = barePhone?.ok ? await graph(`${phoneId}?fields=id,display_phone_number,verified_name`) : null;
    const scopes = ["whatsapp_business_management", "whatsapp_business_messaging", "business_management"];
    const granted = Array.isArray(permissions?.data?.data) ? permissions.data.data : [];
    const scopeStatus = Object.fromEntries(scopes.map((name) => [name,
      permissions?.ok ? (granted.find((x) => x.permission === name)?.status || "not_listed") : "not_verified"
    ]));
    const idMatches = barePhone?.ok && String(barePhone.data?.id) === phoneId;
    const verified = Boolean(metaIdentity.ok && idMatches && phoneDetails?.ok && String(phoneDetails.data?.id) === phoneId);
    return respond({
      valid: verified,
      reason: verified ? "phone_read_verified" : "meta_access_diagnostic",
      checks: {
        token_identity: summarize(metaIdentity),
        permissions: permissions ? summarize(permissions) : { skipped: true },
        phone_basic: barePhone ? summarize(barePhone) : { skipped: true },
        phone_details: phoneDetails ? summarize(phoneDetails) : { skipped: true },
      },
      granted_scope_status: scopeStatus,
      phone_number_id_matches: Boolean(idMatches),
      credential_status: credential.status,
      connection_status: connection.connection_status,
      credential_linked: Boolean(connection.credential_reference),
      sending_enabled: false,
      database_modified: false,
    });
  } catch {
    return respond({ error: "Credential verification unavailable" }, 503);
  }
}
