export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MINUTE = 60 * 1000;
const WINDOW = 30 * MINUTE;
const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Deterministic, synthetic-only temporal verification. No database reads/writes,
// Meta API calls, messages, credits, or production pause state changes.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return reply({ error: "Unauthorized" }, 401);
  const configured = process.env.CHATBOT_HOMOLOGATION_PHONE_NUMBER_ID;
  if (!configured || !/^\d{5,30}$/.test(configured)) return reply({ error: "Homologation phone not configured" }, 503);

  const origin = Date.parse("2026-01-01T12:00:00.000Z");
  const interventions = [
    { organization: "ROOT_TEST", contact: "A", at: origin },
    { organization: "ROOT_TEST", contact: "A", at: origin + 20 * MINUTE },
    { organization: "ROOT_TEST", contact: "B", at: origin + 5 * MINUTE },
    { organization: "OTHER_TEST", contact: "A", at: origin + 10 * MINUTE },
  ];
  const lastHuman = (organization, contact, now) => interventions
    .filter(x => x.organization === organization && x.contact === contact && x.at <= now)
    .reduce((max, x) => Math.max(max, x.at), -Infinity);
  const paused = (organization, contact, now) => now < lastHuman(organization, contact, now) + WINDOW;
  const tests = [
    { name: "pause_immediate", org: "ROOT_TEST", contact: "A", at: origin + MINUTE, expected: true },
    { name: "reset_by_new_human_message", org: "ROOT_TEST", contact: "A", at: origin + 35 * MINUTE, expected: true },
    { name: "resume_exactly_30_minutes_after_last_human", org: "ROOT_TEST", contact: "A", at: origin + 50 * MINUTE, expected: false },
    { name: "pause_just_before_expiry", org: "ROOT_TEST", contact: "A", at: origin + 50 * MINUTE - 1, expected: true },
    { name: "other_contact_not_paused_by_A", org: "ROOT_TEST", contact: "C", at: origin + 21 * MINUTE, expected: false },
    { name: "contact_B_has_own_pause", org: "ROOT_TEST", contact: "B", at: origin + 21 * MINUTE, expected: true },
    { name: "other_organization_isolated", org: "OTHER_TEST", contact: "A", at: origin + 41 * MINUTE, expected: false },
    { name: "future_event_does_not_pause_past", org: "ROOT_TEST", contact: "A", at: origin - MINUTE, expected: false },
  ];
  const results = tests.map(t => {
    const actual = paused(t.org, t.contact, t.at);
    return { scenario: t.name, passed: actual === t.expected, expected_paused: t.expected, actual_paused: actual };
  });
  const passed = results.filter(t => t.passed).length;
  return reply({ mode: "synthetic_timeline_only", scope: "ROOT_homologation", pause_minutes: 30,
    sends_enabled: false, database_modified: false, credits_debited: false,
    passed, total: results.length, all_passed: passed === results.length, results });
}
