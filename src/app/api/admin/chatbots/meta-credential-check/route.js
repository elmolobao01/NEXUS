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
    const wabaId = connection.waba_id;
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
    // Inspect token-to-app binding and granular asset grants without exposing
    // access tokens, Meta user IDs, or business identifiers to the browser.
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    let tokenDebug = null;
    let debugSubjectId = null;
    if (appId && appSecret) {
      try {
        const debugUrl = new URL("https://graph.facebook.com/v26.0/debug_token");
        debugUrl.searchParams.set("input_token", accessToken);
        const r = await fetch(debugUrl, {
          headers: { Authorization: `Bearer ${appId}|${appSecret}` },
          cache: "no-store", signal: AbortSignal.timeout(12000),
        });
        const payload = await r.json().catch(() => ({}));
        const info = payload?.data;
        const grants = Array.isArray(info?.granular_scopes) ? info.granular_scopes : [];
        debugSubjectId = info?.user_id == null ? null : String(info.user_id);
        tokenDebug = {
          checked: true,
          http_status: r.status,
          valid: typeof info?.is_valid === "boolean" ? info.is_valid : null,
          app_matches: typeof info?.app_id === "string" ? info.app_id === appId : null,
          type: typeof info?.type === "string" ? info.type.slice(0, 40) : null,
          // The debug_token user_id is the token subject; compare only against the
          // explicitly configured Meta system user. Never expose its raw ID.
          subject_id_present: typeof info?.user_id === "string" || typeof info?.user_id === "number",
          subject_matches_employee: info?.user_id == null ? null : String(info.user_id) === "61595962941130",
          // Only report booleans for the configured WABA, never other target IDs.
          granular_whatsapp_management: grants.filter((g) => g.scope === "whatsapp_business_management").map((g) => ({
            target_ids_present: Array.isArray(g.target_ids),
            configured_waba_listed: Array.isArray(g.target_ids) ? g.target_ids.map(String).includes(wabaId) : null,
          })),
          granular_whatsapp_messaging: grants.filter((g) => g.scope === "whatsapp_business_messaging").map((g) => ({
            target_ids_present: Array.isArray(g.target_ids),
            configured_waba_listed: Array.isArray(g.target_ids) ? g.target_ids.map(String).includes(wabaId) : null,
          })),
          meta_error_code: Number.isSafeInteger(payload?.error?.code) ? payload.error.code : null,
        };
      } catch { tokenDebug = { checked: false, reason: "debug_request_failed" }; }
    }
    const metaIdentity = await graph("me?fields=id");
    // Compare the Graph /me identity with debug_token's subject. The token
    // subject may be a business-integration system user rather than a system
    // user visible in the current Business Settings UI.
    const subjectConsistency = debugSubjectId == null || !metaIdentity.ok
      ? null : String(metaIdentity.data?.id) === debugSubjectId;
    // Read-only probes. Failures here are informational and never gate the
    // existing credential validation or mutate any Meta/Supabase resource.
    const employeeLookup = metaIdentity.ok
      ? await graph("61595962941130?fields=id") : null;
    const subjectLookup = metaIdentity.ok && debugSubjectId && /^\d{1,30}$/.test(debugSubjectId)
      ? await graph(`${debugSubjectId}?fields=id`) : null;
    // Do not request permissions when the token cannot even identify its subject.
    const permissions = metaIdentity.ok ? await graph("me/permissions?limit=100") : null;
    const barePhone = metaIdentity.ok ? await graph(`${phoneId}?fields=id`) : null;
    const phoneDetails = barePhone?.ok ? await graph(`${phoneId}?fields=id,display_phone_number,verified_name`) : null;
    // Verify the authorized WABA independently from direct phone-number lookup.
    // Do not expose business identifiers, phone numbers, or raw Graph API responses.
    const wabaBasic = metaIdentity.ok ? await graph(`${wabaId}?fields=id`) : null;
    const wabaPhones = wabaBasic?.ok ? await graph(`${wabaId}/phone_numbers?fields=id&limit=100`) : null;
    const phoneRecords = Array.isArray(wabaPhones?.data?.data) ? wabaPhones.data.data : [];
    const phoneInWaba = wabaPhones?.ok && phoneRecords.some((item) => String(item?.id) === phoneId);
    const wabaMatches = wabaBasic?.ok && String(wabaBasic.data?.id) === wabaId;
    const scopes = ["whatsapp_business_management", "whatsapp_business_messaging", "business_management"];
    const granted = Array.isArray(permissions?.data?.data) ? permissions.data.data : [];
    const scopeStatus = Object.fromEntries(scopes.map((name) => [name,
      permissions?.ok ? (granted.find((x) => x.permission === name)?.status || "not_listed") : "not_verified"
    ]));
    const idMatches = barePhone?.ok && String(barePhone.data?.id) === phoneId;
    // Either successful direct phone lookup or an authorized WABA listing confirms
    // the configured phone's asset association. This is read-only access validation,
    // not proof of permission to send messages.
    const verified = Boolean(metaIdentity.ok && wabaMatches && phoneInWaba);
    return respond({
      valid: verified,
      reason: verified ? "waba_phone_membership_verified" : "meta_access_diagnostic",
      checks: {
        token_identity: summarize(metaIdentity),
        permissions: permissions ? summarize(permissions) : { skipped: true },
        phone_basic: barePhone ? summarize(barePhone) : { skipped: true },
        phone_details: phoneDetails ? summarize(phoneDetails) : { skipped: true },
        waba_basic: wabaBasic ? summarize(wabaBasic) : { skipped: true },
        waba_phone_numbers: wabaPhones ? summarize(wabaPhones) : { skipped: true },
      },
      granted_scope_status: scopeStatus,
      identity_access_diagnostic: {
        debug_subject_matches_me: subjectConsistency,
        employee_readable_by_token: employeeLookup ? summarize(employeeLookup) : { skipped: true },
        token_subject_readable_by_token: subjectLookup ? summarize(subjectLookup) : { skipped: true },
        // An identity mismatch does not prove a faulty token: Meta may issue
        // Business Integration System User tokens with different subject IDs.
        subject_differs_from_visible_employee: debugSubjectId == null ? null : debugSubjectId !== "61595962941130",
      },
      token_asset_diagnostic: tokenDebug || { checked: false, reason: "app_configuration_missing" },
      phone_number_id_matches: Boolean(idMatches),
      waba_id_matches: Boolean(wabaMatches),
      phone_listed_in_waba: Boolean(phoneInWaba),
      selected_credential_id: credential.id,
      selected_credential_created_at: credential.created_at,
      pending_credential_count: credentials.filter((item) => item.status === "pending_verification").length,
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
