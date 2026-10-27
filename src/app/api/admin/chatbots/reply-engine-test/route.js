import { basicReply } from "../../../portal/chatbot/basic-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const respond = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!base || !pub || !service) return respond({ error: "Service unavailable" }, 503);
  if (!token) return respond({ error: "Unauthorized" }, 401);
  try {
    const input = await request.json();
    if (!uuid.test(input?.organization_id || "") || typeof input?.message !== "string" || input.message.length > 1000)
      return respond({ error: "Invalid input" }, 400);
    const user = { apikey: pub, Authorization: `Bearer ${token}` };
    const admin = { apikey: service, Authorization: `Bearer ${service}` };
    const identity = await fetch(`${base}/auth/v1/user`, { headers: user, cache: "no-store" });
    if (!identity.ok) return respond({ error: "Unauthorized" }, 401);
    const who = await identity.json();
    if (!who?.id) return respond({ error: "Unauthorized" }, 401);
    const profile = await fetch(`${base}/rest/v1/nexus_user_profiles?select=profile,active&user_id=eq.${encodeURIComponent(who.id)}&active=eq.true`, { headers: admin, cache: "no-store" });
    if (!profile.ok) return respond({ error: "Authorization unavailable" }, 503);
    const profiles = await profile.json();
    if (!Array.isArray(profiles) || !profiles.some(x => x.profile === "NEXUS_ROOT" && x.active === true))
      return respond({ error: "Forbidden" }, 403);
    const configResponse = await fetch(`${base}/rest/v1/nexus_chatbot_configs?select=active,welcome_message,closing_message,faq&organization_id=eq.${encodeURIComponent(input.organization_id)}&limit=1`, { headers: admin, cache: "no-store" });
    if (!configResponse.ok) return respond({ error: "Configuration unavailable" }, 503);
    const configs = await configResponse.json();
    if (!Array.isArray(configs)) return respond({ error: "Configuration unavailable" }, 503);
    const config = configs[0] || null;
    const result = basicReply(config, input.message);
    return respond({ mode: "rule_engine_preview_only", organization_id: input.organization_id,
      engine: "deterministic_basic", configured: Boolean(config), response_type: result.type,
      matched_faq: result.type === "faq", requires_human_review: result.type === "fallback",
      human_handoff_executed: false, faq_entries: Array.isArray(config?.faq) ? config.faq.length : 0,
      suggested_reply: result.reply, ai_called: false, sending_enabled: false,
      database_modified: false, credits_debited: false, meta_called: false });
  } catch {
    return respond({ error: "Engine preview unavailable" }, 503);
  }
}
