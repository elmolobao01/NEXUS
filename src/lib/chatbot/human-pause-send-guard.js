// Guard for a future REAL WhatsApp send path. No send, debit, or database mutation here.
// Call immediately before the Meta request, and only after resolving the authenticated tenant.
const PHONE_RE = /^\d{7,20}$/;
const META_ID_RE = /^\d{5,30}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function evaluateHumanPause(rows, nowMs = Date.now()) {
  if (!Array.isArray(rows) || rows.length > 1 || !Number.isFinite(nowMs)) {
    return { allow: false, reason: "pause_state_invalid" };
  }
  if (rows.length === 0) return { allow: true, reason: "no_human_pause" };
  const row = rows[0];
  const at = Date.parse(row.last_human_at);
  const until = Date.parse(row.pause_until);
  if (!Number.isFinite(at) || !Number.isFinite(until) ||
      until !== at + 30 * 60 * 1000) {
    return { allow: false, reason: "pause_state_invalid" };
  }
  if (nowMs < until) return { allow: false, reason: "human_pause_30m", pause_until: row.pause_until };
  return { allow: true, reason: "human_pause_expired" };
}

export async function checkHumanPauseBeforeMetaSend({
  organizationId, phoneNumberId, contactPhone, fetchImpl = fetch, nowMs = Date.now(),
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
}) {
  // No fallback to "allow" on malformed identity, missing credentials, or DB failure.
  if (!UUID_RE.test(organizationId || "") || !META_ID_RE.test(phoneNumberId || "") ||
      !PHONE_RE.test(contactPhone || "") || !supabaseUrl || !serviceRoleKey) {
    return { allow: false, reason: "pause_guard_unavailable" };
  }
  try {
    const url = new URL(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/nexus_chatbot_human_pauses`);
    url.searchParams.set("select", "last_human_at,pause_until");
    url.searchParams.set("organization_id", `eq.${organizationId}`);
    url.searchParams.set("phone_number_id", `eq.${phoneNumberId}`);
    url.searchParams.set("contact_phone", `eq.${contactPhone}`);
    url.searchParams.set("limit", "2");
    const res = await fetchImpl(url.toString(), {
      method: "GET",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      cache: "no-store",
    });
    if (!res.ok) return { allow: false, reason: "pause_guard_db_error" };
    return evaluateHumanPause(await res.json(), nowMs);
  } catch {
    return { allow: false, reason: "pause_guard_db_error" };
  }
}
