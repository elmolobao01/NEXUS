export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return reply({ error: "Unauthorized" }, 401);
  const phone = process.env.CHATBOT_HOMOLOGATION_PHONE_NUMBER_ID;
  if (!phone || !/^\d{5,30}$/.test(phone)) return reply({ error: "Homologation phone not configured" }, 503);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return reply({ error: "Service unavailable" }, 503);
  try {
    const params = new URLSearchParams({
      select: "organization_id,phone_number_id,contact_phone,last_human_at,pause_until",
      phone_number_id: `eq.${phone}`,
      order: "last_human_at.desc",
      limit: "100"
    });
    const response = await fetch(`${base}/rest/v1/nexus_chatbot_human_pauses?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store"
    });
    if (!response.ok) return reply({ error: "Pause state unavailable", database_status: response.status }, 503);
    const rows = await response.json();
    const now = Date.now();
    const states = rows.map((r) => ({
      // Do not expose contact identifiers or raw message data.
      paused: new Date(r.pause_until).getTime() > now,
      last_human_at: r.last_human_at,
      pause_until: r.pause_until
    }));
    return reply({
      mode: "read_only_homologation",
      scope: "single_homologation_phone",
      sending_enabled: false,
      database_modified: false,
      credits_debited: false,
      records_scanned: states.length,
      paused_now: states.filter((r) => r.paused).length,
      expired_now: states.filter((r) => !r.paused).length,
      states
    });
  } catch {
    return reply({ error: "Pause state inspection failed" }, 503);
  }
}
