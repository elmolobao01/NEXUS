import { basicReply } from "../../../portal/chatbot/basic-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!base || !pub || !service) return json({ error: "Service unavailable" }, 503);
  if (!token) return json({ error: "Unauthorized" }, 401);
  try {
    const input = await request.json();
    if (!uuid.test(input?.organization_id || "") || !Array.isArray(input?.faq) || input.faq.length > 20 ||
        input.faq.some(x => !x || typeof x.question !== "string" || typeof x.answer !== "string" ||
          x.question.length > 300 || x.answer.length > 1000)) {
      return json({ error: "Invalid input" }, 400);
    }
    const userHeaders = { apikey: pub, Authorization: `Bearer ${token}` };
    const adminHeaders = { apikey: service, Authorization: `Bearer ${service}` };
    const identity = await fetch(`${base}/auth/v1/user`, { headers: userHeaders, cache: "no-store" });
    if (!identity.ok) return json({ error: "Unauthorized" }, 401);
    const who = await identity.json();
    if (!who?.id) return json({ error: "Unauthorized" }, 401);
    const profile = await fetch(`${base}/rest/v1/nexus_user_profiles?select=profile,active&user_id=eq.${encodeURIComponent(who.id)}&active=eq.true`, { headers: adminHeaders, cache: "no-store" });
    if (!profile.ok) return json({ error: "Authorization unavailable" }, 503);
    const profiles = await profile.json();
    if (!Array.isArray(profiles) || !profiles.some(x => x.profile === "NEXUS_ROOT" && x.active === true))
      return json({ error: "Forbidden" }, 403);


    const configResponse = await fetch(`${base}/rest/v1/nexus_chatbot_configs?select=active,welcome_message,closing_message,faq&organization_id=eq.${encodeURIComponent(input.organization_id)}&limit=1`, { headers: adminHeaders, cache: "no-store" });
    if (!configResponse.ok) return json({ error: "Configuration unavailable" }, 503);
    const configs = await configResponse.json();
    if (!Array.isArray(configs) || !configs[0]) return json({ error: "Chatbot not configured" }, 404);
    const simulated = { ...configs[0], faq: input.faq };
    const baseTime = Date.parse("2026-10-27T12:00:00.000Z");
    // These are synthetic transitions, not persisted human-pause state.
    const steps = [
      { minute: 0, action: "incoming", message: "Vocês oferecem transfer?" },
      { minute: 1, action: "handoff_requested" },
      { minute: 2, action: "human_assumed" },
      { minute: 10, action: "incoming", message: "Qual é o horário do check-in?" },
      { minute: 31, action: "incoming", message: "Qual é o horário do check-in?" },
      { minute: 32, action: "incoming", message: "Qual é o horário do check-in?" },
      { minute: 33, action: "human_assumed" },
      { minute: 62, action: "incoming", message: "Qual é o horário do check-in?" },
      { minute: 63, action: "incoming", message: "Qual é o horário do check-in?" },
      { minute: 64, action: "incoming", message: "Qual é o horário do check-in?" }
    ];
    let handoffRequested = false;
    let humanAssumed = false;
    let pauseUntil = 0;
    const timeline = steps.map((step, index) => {
      const now = baseTime + step.minute * 60000;
      if (step.action === "handoff_requested") {
        handoffRequested = true;
        return { index, minute: step.minute, event: step.action, handoff_requested: true, human_assumed: humanAssumed, automatic_reply_allowed: false };
      }
      if (step.action === "human_assumed") {
        humanAssumed = true;
        pauseUntil = now + 30 * 60000;
        return { index, minute: step.minute, event: step.action, human_assumed: true, pause_until: new Date(pauseUntil).toISOString(), automatic_reply_allowed: false };
      }
      const result = basicReply(simulated, step.message);
      const paused = now < pauseUntil;
      const suggested = result.type === "fallback";
      return {
        index, minute: step.minute, event: "incoming", message: step.message,
        response_type: result.type, human_handoff_suggested: suggested,
        handoff_requested: handoffRequested, human_assumed: humanAssumed,
        pause_active: paused, automatic_reply_allowed: !paused && !suggested,
        suggested_reply: !paused ? result.reply : null,
        human_handoff_executed: false
      };
    });
    const at = (minute) => timeline.find(x => x.minute === minute);
    const checks = {
      fallback_suggests_handoff: at(0).human_handoff_suggested === true,
      suggestion_does_not_execute_handoff: at(0).human_handoff_executed === false,
      request_distinct_from_assumption: at(1).handoff_requested === true && at(1).human_assumed === false,
      human_assumption_starts_30m_pause: at(2).pause_until === new Date(baseTime + 32 * 60000).toISOString(),
      during_pause_blocked: at(10).pause_active === true && at(10).automatic_reply_allowed === false,
      one_minute_before_expiration_blocked: at(31).pause_active === true && at(31).automatic_reply_allowed === false,
      first_pause_expires_at_exact_boundary: at(32).pause_active === false && at(32).automatic_reply_allowed === true,
      second_assumption_renews_pause: at(33).pause_until === new Date(baseTime + 63 * 60000).toISOString(),
      renewed_pause_blocks: at(62).pause_active === true && at(62).automatic_reply_allowed === false,
      renewed_pause_expires_at_exact_boundary: at(63).pause_active === false && at(63).automatic_reply_allowed === true,
      after_expiration_remains_unblocked: at(64).pause_active === false && at(64).automatic_reply_allowed === true
    };
    return json({
      mode: "synthetic_human_handoff_preview_only",
      organization_id: input.organization_id,
      real_faq_entries: Array.isArray(configs[0].faq) ? configs[0].faq.length : 0,
      simulated_faq_entries: input.faq.length,
      timeline, assessment: { tested: Object.keys(checks).length,
        passed: Object.values(checks).filter(Boolean).length,
        failed: Object.values(checks).filter(v => !v).length, checks },
      limitation: "Simulated state and clock only; no persistent handoff, pause, or human assignment was performed.",
      sending_enabled: false, database_modified: false, credits_debited: false,
      meta_called: false, human_handoff_executed: false
    });
  } catch (error) {
    console.error("handoff_synthetic_preview_failed", error?.message || "unknown");
    return json({ error: "Preview unavailable" }, 503);
  }
}
