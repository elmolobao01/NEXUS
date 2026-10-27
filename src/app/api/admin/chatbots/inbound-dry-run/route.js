import { inspectInboundDryRun } from "../../../cron/chatbot-inbound/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const respond = (data, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request) {
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

    // Uses exactly the cron's existing logic, including its single-phone allowlist.
    // No CRON_SECRET is transmitted to the browser.
    return await inspectInboundDryRun();
  } catch (error) {
    console.error("admin_inbound_dry_run_failed", error?.message || "unknown");
    return respond({ error: "Inspection unavailable" }, 503);
  }
}
