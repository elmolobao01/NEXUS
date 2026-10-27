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
        !Array.isArray(input?.messages) || input.messages.length < 1 || input.messages.length > 20 ||
        input.faq.some(x => !x || typeof x.question !== "string" || typeof x.answer !== "string" ||
          x.question.length > 300 || x.answer.length > 1000) ||
        input.messages.some(x => !(typeof x === "string" && x.length <= 1000) &&
          !(x && typeof x.message === "string" && x.message.length <= 1000 &&
            ["welcome", "closing", "faq", "fallback", "invalid", "inactive"].includes(x.expected_type)))) {
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
    const config = configs[0];
    const simulated = { ...config, faq: input.faq };
    const cases = input.messages.map((test, index) => {
      const message = typeof test === "string" ? test : test.message;
      const expected = typeof test === "string" ? null : test.expected_type;
      const result = basicReply(simulated, message);
      const matches = input.faq.filter(x => x.answer === result.reply).map(x => x.question);
      return {
        index, message, expected_type: expected,
        response_type: result.type, suggested_reply: result.reply,
        matches_expected_type: expected ? result.type === expected : null,
        matched_faq_questions: result.type === "faq" ? matches : [],
        human_handoff_suggested: result.type === "fallback",
        human_handoff_executed: false
      };
    });
    const assessed = cases.filter(x => x.matches_expected_type !== null);
    const failures = assessed.filter(x => !x.matches_expected_type);
    const normalized = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    const duplicateQuestions = [];
    const seen = new Map();
    input.faq.forEach((item, i) => {
      const key = normalized(item.question);
      if (seen.has(key)) duplicateQuestions.push({ first_index: seen.get(key), second_index: i });
      else seen.set(key, i);
    });
    return json({ mode: "advanced_synthetic_faq_preview_only",
      organization_id: input.organization_id, engine: "deterministic_basic",
      real_chatbot_active: config.active === true,
      real_faq_entries: Array.isArray(config.faq) ? config.faq.length : 0,
      simulated_faq_entries: input.faq.length, cases,
      assessment: { tested: assessed.length, passed: assessed.length - failures.length,
        failed: failures.length, failed_indices: failures.map(x => x.index),
        duplicate_normalized_faq_questions: duplicateQuestions,
        ambiguity_safety_not_guaranteed: true },
      ai_called: false, sending_enabled: false, database_modified: false,
      credits_debited: false, meta_called: false, human_handoff_executed: false });
  } catch (error) {
    console.error("faq_advanced_preview_failed", error?.message || "unknown");
    return json({ error: "Preview unavailable" }, 503);
  }
}
