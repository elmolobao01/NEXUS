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
    let metaResponse;
    try {
      metaResponse = await fetch(`https://graph.facebook.com/v26.0/${phoneId}?fields=id,display_phone_number,verified_name`, {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(12000),
      });
    } catch {
      return respond({ valid: false, reason: "meta_unreachable", sending_enabled: false });
    }
    if (!metaResponse.ok) {
      let code = null;
      let subcode = null;
      let errorType = null;
      let diagnostic = "unclassified_meta_error";
      try {
        const data = await metaResponse.json();
        const error = data?.error;
        if (Number.isSafeInteger(error?.code)) code = error.code;
        if (Number.isSafeInteger(error?.error_subcode)) subcode = error.error_subcode;
        if (["OAuthException", "GraphMethodException", "FacebookApiException"].includes(error?.type)) errorType = error.type;
        // Classify the error internally; never return the raw Meta message,
        // which can contain request-specific identifiers or sensitive material.
        const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
        if (/expired|session has expired/.test(message) || code === 190 && [463, 467].includes(subcode)) diagnostic = "token_expired_or_revoked";
        else if (/invalid oauth|invalid access token|cannot parse access token|error validating access token/.test(message) || code === 190) diagnostic = "token_invalid_or_unusable";
        else if (/permission|not authorized|not authorised|does not have access/.test(message)) diagnostic = "insufficient_permissions_or_access";
        else if (/nonexisting field|nonexistent field|unknown field|field.*does not exist|invalid field/.test(message)) diagnostic = "unsupported_or_invalid_field";
        else if (/unsupported get request|does not exist|cannot be loaded|missing permissions/.test(message)) diagnostic = "resource_not_accessible_or_invalid_id";
        else if (/unsupported version|invalid version/.test(message)) diagnostic = "graph_api_version_issue";
        else if (code === 100) diagnostic = "invalid_parameter_or_resource";
      } catch { /* Return only sanitized diagnostic fields. */ }
      return respond({
        valid: false,
        reason: "meta_rejected_credential",
        http_status: metaResponse.status,
        meta_error_code: code,
        meta_error_subcode: subcode,
        meta_error_type: errorType,
        diagnostic,
        sending_enabled: false,
        database_modified: false,
      });
    }
    const phone = await metaResponse.json();
    if (String(phone?.id) !== phoneId) return respond({ valid: false, reason: "phone_id_mismatch", sending_enabled: false });
    return respond({ valid: true, reason: "phone_read_verified", credential_status: credential.status, connection_status: connection.connection_status, credential_linked: Boolean(connection.credential_reference), phone_number_id_matches: true, sending_enabled: false, database_modified: false });
  } catch {
    return respond({ error: "Credential verification unavailable" }, 503);
  }
}
