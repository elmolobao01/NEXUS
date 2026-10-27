// ROOT-only, read-only audit of persistent human pauses.
// Does not return contact identifiers or execute any write operations.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const respond = (body, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store" }
});

export async function GET(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!base || !pub || !service) return respond({ error: "Service unavailable" }, 503);
  if (!token) return respond({ error: "Unauthorized" }, 401);

  try {
    const userHeaders = { apikey: pub, Authorization: `Bearer ${token}` };
    const adminHeaders = { apikey: service, Authorization: `Bearer ${service}` };
    const identity = await fetch(`${base}/auth/v1/user`, {
      headers: userHeaders, cache: "no-store"
    });
    if (!identity.ok) return respond({ error: "Unauthorized" }, 401);
    const who = await identity.json();
    if (!who?.id) return respond({ error: "Unauthorized" }, 401);

    const profile = await fetch(
      `${base}/rest/v1/nexus_user_profiles?select=profile,active&user_id=eq.${encodeURIComponent(who.id)}&active=eq.true`,
      { headers: adminHeaders, cache: "no-store" }
    );
    if (!profile.ok) return respond({ error: "Authorization unavailable" }, 503);
    const profiles = await profile.json();
    if (!Array.isArray(profiles) ||
        !profiles.some(x => x.profile === "NEXUS_ROOT" && x.active === true)) {
      return respond({ error: "Forbidden" }, 403);
    }

    const org = new URL(request.url).searchParams.get("organization_id");
    if (!org || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(org)) {
      return respond({ error: "Invalid organization_id" }, 400);
    }

    const query = new URLSearchParams({
      organization_id: `eq.${org}`,
      select: "organization_id,phone_number_id,contact_phone,last_human_at,pause_until",
      order: "pause_until.desc",
      limit: "1001"
    });
    const response = await fetch(
      `${base}/rest/v1/nexus_chatbot_human_pauses?${query.toString()}`,
      { method: "GET", headers: adminHeaders, cache: "no-store" }
    );
    if (!response.ok) {
      console.error("human_pause_audit_read_failed", response.status);
      return respond({ error: "Pause audit unavailable" }, 503);
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length >= 1001) {
      return respond({ error: "Pause audit sample limit exceeded; no partial result returned" }, 503);
    }
    const now = Date.now();
    const counts = {
      total: rows.length, active: 0, expired: 0,
      invalid_timestamp: 0, invalid_duration: 0,
      invalid_identity: 0, duplicate_contact_scope: 0
    };
    const issues = [];
    const seen = new Set();
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const flags = [];
      const last = Date.parse(row.last_human_at);
      const until = Date.parse(row.pause_until);
      const validTime = Number.isFinite(last) && Number.isFinite(until);
      if (!validTime) {
        counts.invalid_timestamp++;
        flags.push("invalid_timestamp");
      } else {
        if (until !== last + 30 * 60 * 1000) {
          counts.invalid_duration++;
          flags.push("invalid_30_minute_duration");
        }
        if (now < until) counts.active++;
        else counts.expired++;
      }
      if (row.organization_id !== org ||
          !uuidRe.test(row.organization_id || "") ||
          !/^\\d{5,30}$/.test(row.phone_number_id || "") ||
          !/^\\d{7,20}$/.test(row.contact_phone || "")) {
        counts.invalid_identity++;
        flags.push("invalid_scope_or_identity");
      }
      // Internal only: never expose phone or contact to the browser.
      const key = JSON.stringify([row.organization_id, row.phone_number_id, row.contact_phone]);
      if (seen.has(key)) {
        counts.duplicate_contact_scope++;
        flags.push("duplicate_contact_scope");
      }
      seen.add(key);
      if (flags.length) issues.push({ row_index: i, flags });
    }
    return respond({
      mode: "root_human_pause_persistence_audit_read_only",
      organization_id: org,
      evaluated_at: new Date(now).toISOString(),
      counts, issues,
      safety: {
        tenant_filter_applied: true,
        no_contact_identifiers_returned: true,
        all_records_within_limit: true,
        sending_enabled: false, database_modified: false,
        credits_debited: false, meta_called: false
      },
      limitations: [
        "Read-only snapshot; does not guarantee an atomic pre-send guard",
        "No assignment or handoff workflow tested",
        "No changes made to persistent pause records"
      ]
    });
  } catch (error) {
    console.error("human_pause_audit_failed", error?.message || "unknown");
    return respond({ error: "Pause audit unavailable" }, 503);
  }
}
