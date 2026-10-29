// Shared response router: Basic and Standard use the same transactional pipeline.
// No provider call, wallet mutation or Meta transport is performed on import.
import { basicReply } from '../../app/api/portal/chatbot/basic-engine';

export const CHATBOT_PLANS = Object.freeze({
  CHATBOT_BASIC: Object.freeze({ engine: 'rules', included_messages: 1000 }),
  CHATBOT_AI: Object.freeze({ engine: 'rules_and_ai', included_messages: 2000 }),
});

const positiveInteger = n => Number.isSafeInteger(n) && n > 0;
const safeReply = result => result && typeof result.reply === 'string' &&
  result.reply.trim().length > 0 && result.reply.length <= 4096;

// AI provider must be injected by a separately reviewed integration.
// An explicit per-tenant AI budget is mandatory; no default/implicit unlimited usage.
export async function selectChatbotReply({
  planCode, config, message, aiProvider, aiPolicy, aiUsage,
} = {}) {
  const plan = CHATBOT_PLANS[planCode];
  if (!plan) return { allow: false, reason: 'unknown_plan' };
  if (!config?.active) return { allow: false, reason: 'chatbot_inactive' };
  if (typeof message !== 'string' || !message.trim() || message.length > 1000)
    return { allow: false, reason: 'invalid_message' };

  const deterministic = basicReply(config, message);
  // Greeting, closing and FAQ answers take precedence in BOTH plans.
  if (deterministic.type !== 'fallback') {
    if (!safeReply(deterministic)) return { allow: false, reason: 'invalid_rule_reply' };
    return { allow: true, engine: 'rules', type: deterministic.type, reply: deterministic.reply };
  }
  if (plan.engine === 'rules') {
    return safeReply(deterministic)
      ? { allow: true, engine: 'rules', type: 'fallback', reply: deterministic.reply }
      : { allow: false, reason: 'invalid_fallback' };
  }
  // Standard: no unbudgeted AI calls, even when an AI provider is connected.
  if (typeof aiProvider !== 'function' ||
      !positiveInteger(aiPolicy?.max_requests_per_cycle) ||
      !Number.isSafeInteger(aiUsage?.requests_this_cycle) ||
      aiUsage.requests_this_cycle < 0 ||
      aiUsage.requests_this_cycle >= aiPolicy.max_requests_per_cycle) {
    return { allow: false, reason: 'ai_not_authorized_or_budget_exhausted' };
  }
  // A production implementation must atomically reserve AI quota BEFORE
  // calling the provider; this router does not make that reservation.
  if (aiPolicy?.quota_reserved !== true || typeof aiPolicy?.reservation_id !== 'string' ||
      !aiPolicy.reservation_id.trim()) {
    return { allow: false, reason: 'ai_quota_reservation_required' };
  }
  try {
    const result = await aiProvider({ message, config, reservationId: aiPolicy.reservation_id });
    if (!safeReply(result)) return { allow: false, reason: 'invalid_ai_reply' };
    return { allow: true, engine: 'ai', type: 'ai', reply: result.reply };
  } catch {
    return { allow: false, reason: 'ai_provider_unavailable' };
  }
}
