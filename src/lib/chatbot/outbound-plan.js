// Pure decision engine: no Meta calls, wallet debits or database mutations.
import { evaluateHumanPause } from "./human-pause-send-guard";

const PLAN_CODES = new Set(["CHATBOT_BASIC", "CHATBOT_AI"]);
export function planOutbound({ organizationId, phoneNumberId, contactPhone, messageId,
  connectionActive, contractCode, chatbotActive, wallet, pauseRows, reply, nowMs = Date.now() }) {
  const deny = reason => ({ eligible: false, reason, send_enabled: false, debit_enabled: false });
  if (!organizationId || !phoneNumberId || !/^\d{7,20}$/.test(contactPhone || "") ||
      !messageId || typeof messageId !== "string") return deny("invalid_scope_or_message");
  const pause = evaluateHumanPause(pauseRows, nowMs);
  if (!pause.allow) return deny(pause.reason);
  if (!connectionActive) return deny("connection_not_active");
  if (!PLAN_CODES.has(contractCode)) return deny("contract_inactive");
  if (!chatbotActive) return deny("chatbot_inactive");
  if (!wallet || wallet.plan_code !== contractCode ||
      !Number.isFinite(Number(wallet.included_remaining)) ||
      !Number.isFinite(Number(wallet.prepaid_remaining)) ||
      Number(wallet.included_remaining) < 0 || Number(wallet.prepaid_remaining) < 0 ||
      Number(wallet.included_remaining) + Number(wallet.prepaid_remaining) <= 0) return deny("wallet_unavailable");
  if (typeof reply !== "string" || !reply.trim()) return deny("no_reply");
  // Eligible is only a planning decision. Atomic claim, wallet reservation,
  // idempotency, and delivery reconciliation must precede actual sending.
  return { eligible: true, reason: "eligible_for_future_atomic_claim",
    send_enabled: false, debit_enabled: false };
}
