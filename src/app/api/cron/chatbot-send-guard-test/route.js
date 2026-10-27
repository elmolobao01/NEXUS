import { evaluateHumanPause, checkHumanPauseBeforeMetaSend } from "../../../../lib/chatbot/human-pause-send-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return reply({ error: "Unauthorized" }, 401);
  const phoneNumberId = process.env.CHATBOT_HOMOLOGATION_PHONE_NUMBER_ID;
  const organizationId = process.env.CHATBOT_HOMOLOGATION_ORGANIZATION_ID || "7ca2ee92-6b12-4f54-ba7b-986bab2f9434";
  if (!phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId)) return reply({ error: "Homologation phone unavailable" }, 503);

  const now = Date.now();
  const at = new Date(now - 5 * 60 * 1000).toISOString();
  const until = new Date(now + 25 * 60 * 1000).toISOString();
  const expiredAt = new Date(now - 40 * 60 * 1000).toISOString();
  const expiredUntil = new Date(now - 10 * 60 * 1000).toISOString();
  const tests = [
    { name: "active_pause_blocks", expected: false, actual: evaluateHumanPause([{ last_human_at: at, pause_until: until }], now).allow },
    { name: "expired_pause_allows", expected: true, actual: evaluateHumanPause([{ last_human_at: expiredAt, pause_until: expiredUntil }], now).allow },
    { name: "no_pause_allows", expected: true, actual: evaluateHumanPause([], now).allow },
    { name: "malformed_state_blocks", expected: false, actual: evaluateHumanPause([{ last_human_at: at, pause_until: "invalid" }], now).allow },
    { name: "duplicate_state_blocks", expected: false, actual: evaluateHumanPause([{ last_human_at: at, pause_until: until }, { last_human_at: at, pause_until: until }], now).allow },
    { name: "db_failure_blocks", expected: false, actual: (await checkHumanPauseBeforeMetaSend({
      organizationId, phoneNumberId, contactPhone: "5511999999999", nowMs: now,
      fetchImpl: async () => { throw new Error("synthetic_failure"); },
    })).allow },
  ];
  const passed = tests.filter(t => t.actual === t.expected).length;
  // Live database state is inspected without exposing any contact or message content.
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return reply({ error: "Service unavailable", synthetic: { passed, total: tests.length, tests } }, 503);
  try {
    const params = new URLSearchParams({
      select: "organization_id,phone_number_id,contact_phone,last_human_at,pause_until",
      organization_id: `eq.${organizationId}`,
      phone_number_id: `eq.${phoneNumberId}`,
      limit: "1000",
    });
    const r = await fetch(`${base.replace(/\/$/, "")}/rest/v1/nexus_chatbot_human_pauses?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
    });
    if (!r.ok) return reply({ error: "Pause table unavailable", synthetic: { passed, total: tests.length, tests } }, 503);
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length >= 1000) return reply({ error: "Pause table incomplete", synthetic: { passed, total: tests.length, tests } }, 503);
    let blocked = 0, eligible = 0, invalid = 0;
    for (const row of rows) {
      const gate = await checkHumanPauseBeforeMetaSend({
        organizationId, phoneNumberId, contactPhone: row.contact_phone, nowMs: now,
      });
      if (gate.reason === "human_pause_30m") blocked++;
      else if (gate.allow) eligible++;
      else invalid++;
    }
    return reply({
      mode: "read_only_pre_send_guard_test",
      sending_enabled: false, database_modified: false, credits_debited: false,
      synthetic: { passed, total: tests.length, tests },
      persisted: { records: rows.length, blocked, eligible, invalid },
    }, passed === tests.length && invalid === 0 ? 200 : 503);
  } catch {
    return reply({ error: "Guard verification failed", synthetic: { passed, total: tests.length, tests } }, 503);
  }
}
