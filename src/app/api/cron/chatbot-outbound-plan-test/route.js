import { timingSafeEqual } from "node:crypto";
// Self-contained, synthetic-only planner to avoid cross-file import deployment errors.
function evaluateHumanPause(rows, nowMs) {
  if (!Array.isArray(rows) || rows.length > 1 || !Number.isFinite(nowMs)) return { allow: false, reason: "pause_state_invalid" };
  if (!rows.length) return { allow: true, reason: "no_human_pause" };
  const at = Date.parse(rows[0].last_human_at);
  const until = Date.parse(rows[0].pause_until);
  if (!Number.isFinite(at) || !Number.isFinite(until) || until !== at + 30 * 60 * 1000) return { allow: false, reason: "pause_state_invalid" };
  return nowMs < until ? { allow: false, reason: "human_pause_30m" } : { allow: true, reason: "human_pause_expired" };
}
function planOutbound({ organizationId, phoneNumberId, contactPhone, messageId, connectionActive, contractCode, chatbotActive, wallet, pauseRows, reply, nowMs = Date.now() }) {
  const deny = reason => ({ eligible: false, reason, send_enabled: false, debit_enabled: false });
  if (!organizationId || !phoneNumberId || !/^\d{7,20}$/.test(contactPhone || "") || !messageId || typeof messageId !== "string") return deny("invalid_scope_or_message");
  const pause = evaluateHumanPause(pauseRows, nowMs);
  if (!pause.allow) return deny(pause.reason);
  if (!connectionActive) return deny("connection_not_active");
  if (!["CHATBOT_BASIC", "CHATBOT_AI"].includes(contractCode)) return deny("contract_inactive");
  if (!chatbotActive) return deny("chatbot_inactive");
  if (!wallet || wallet.plan_code !== contractCode || !Number.isFinite(Number(wallet.included_remaining)) || !Number.isFinite(Number(wallet.prepaid_remaining)) || Number(wallet.included_remaining) < 0 || Number(wallet.prepaid_remaining) < 0 || Number(wallet.included_remaining) + Number(wallet.prepaid_remaining) <= 0) return deny("wallet_unavailable");
  if (typeof reply !== "string" || !reply.trim()) return deny("no_reply");
  return { eligible: true, reason: "eligible_for_future_atomic_claim", send_enabled: false, debit_enabled: false };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") || "";
  const expected = secret ? `Bearer ${secret}` : "";
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return json({ error: "Unauthorized" }, 401);
  if (process.env.CHATBOT_HOMOLOGATION_ORGANIZATION_ID !== "7ca2ee92-6b12-4f54-ba7b-986bab2f9434" ||
      process.env.CHATBOT_HOMOLOGATION_PHONE_NUMBER_ID !== "1295394797000036")
    return json({ error: "Homologation scope not enabled" }, 503);
  const now = Date.now();
  const at = new Date(now - 60000).toISOString();
  const until = new Date(now + 29 * 60000).toISOString();
  const expiredAt = new Date(now - 31 * 60000).toISOString();
  const expiredUntil = new Date(now - 60000).toISOString();
  const base = {
    organizationId: process.env.CHATBOT_HOMOLOGATION_ORGANIZATION_ID,
    phoneNumberId: process.env.CHATBOT_HOMOLOGATION_PHONE_NUMBER_ID,
    contactPhone: "5511999999999", messageId: "synthetic-inbound-1",
    connectionActive: true, contractCode: "CHATBOT_BASIC", chatbotActive: true,
    wallet: { plan_code: "CHATBOT_BASIC", included_remaining: 10, prepaid_remaining: 0 },
    pauseRows: [], reply: "Resposta sintetica", nowMs: now,
  };
  const scenarios = [
    ["active_pause", { pauseRows: [{ last_human_at: at, pause_until: until }] }, "human_pause_30m"],
    ["expired_pause", { pauseRows: [{ last_human_at: expiredAt, pause_until: expiredUntil }] }, "eligible_for_future_atomic_claim"],
    ["no_pause", {}, "eligible_for_future_atomic_claim"],
    ["db_state_invalid", { pauseRows: null }, "pause_state_invalid"],
    ["contract_inactive", { contractCode: "INACTIVE" }, "contract_inactive"],
    ["connection_inactive", { connectionActive: false }, "connection_not_active"],
    ["wallet_empty", { wallet: { plan_code: "CHATBOT_BASIC", included_remaining: 0, prepaid_remaining: 0 } }, "wallet_unavailable"],
    ["wallet_mismatch", { wallet: { plan_code: "CHATBOT_AI", included_remaining: 10, prepaid_remaining: 0 } }, "wallet_unavailable"],
    ["chatbot_inactive", { chatbotActive: false }, "chatbot_inactive"],
    ["no_reply", { reply: "" }, "no_reply"],
    ["missing_message_id", { messageId: "" }, "invalid_scope_or_message"],
  ];
  const tests = scenarios.map(([name, overrides, expected]) => {
    const decision = planOutbound({ ...base, ...overrides });
    return { name, expected, actual: decision.reason, passed: decision.reason === expected &&
      decision.send_enabled === false && decision.debit_enabled === false };
  });
  const passed = tests.filter(t => t.passed).length;
  return json({ mode: "synthetic_outbound_planning_only", scope: "root_phone_only",
    sending_enabled: false, database_modified: false, credits_debited: false,
    meta_called: false, total: tests.length, passed, failed: tests.length - passed, tests },
    passed === tests.length ? 200 : 503);
}
