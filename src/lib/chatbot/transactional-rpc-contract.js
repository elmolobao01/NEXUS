// Static contract for a future, explicitly authorized service-role adapter.
// This module does not import Supabase, invoke RPCs, or mutate any state.
export const CHATBOT_RPC_CONTRACT = Object.freeze({
  claim: Object.freeze({ name: 'nexus_chatbot_inbound_claim', args: ['p_limit'], mutates: true }),
  finish: Object.freeze({ name: 'nexus_chatbot_inbound_finish', args: ['p_job_id', 'p_claim_token', 'p_state', 'p_reason'], mutates: true }),
  activeContract: Object.freeze({ name: 'nexus_chatbot_has_active_contract', args: ['p_organization_id', 'p_plan_code'], mutates: false }),
  reserve: Object.freeze({ name: 'nexus_chatbot_reserve_outbound', args: ['p_organization_id', 'p_idempotency_key'], mutates: true }),
  finalize: Object.freeze({ name: 'nexus_chatbot_finalize_outbound', args: ['p_operation_id', 'p_outcome', 'p_meta_message_id', 'p_error_code'], mutates: true }),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = new Set(['completed', 'blocked', 'failed']);
const OUTCOMES = new Set(['accepted', 'rejected', 'uncertain']);
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// Pure validation. Never calls any RPC, even when input is valid.
export function validateChatbotRpcPayload(operation, args) {
  const spec = CHATBOT_RPC_CONTRACT[operation];
  if (!spec || !args || typeof args !== 'object' || Array.isArray(args)) return { valid: false, reason: 'invalid_operation_or_payload' };
  const required = operation === 'finalize' ? spec.args.slice(0, 2) : spec.args;
  if (!required.every(k => own(args, k)) || Object.keys(args).some(k => !spec.args.includes(k))) return { valid: false, reason: 'argument_mismatch' };
  const isUuid = v => typeof v === 'string' && UUID.test(v);
  const isText = v => typeof v === 'string' && v.length > 0 && v.length <= 512;
  let ok = false;
  switch (operation) {
    case 'claim': ok = Number.isInteger(args.p_limit) && args.p_limit >= 1 && args.p_limit <= 20; break;
    case 'finish': ok = isUuid(args.p_job_id) && isUuid(args.p_claim_token) && STATES.has(args.p_state) && isText(args.p_reason); break;
    case 'activeContract': ok = isUuid(args.p_organization_id) && isText(args.p_plan_code); break;
    case 'reserve': ok = isUuid(args.p_organization_id) && isText(args.p_idempotency_key); break;
    case 'finalize': ok = isUuid(args.p_operation_id) && OUTCOMES.has(args.p_outcome) &&
      (args.p_meta_message_id == null || isText(args.p_meta_message_id)) &&
      (args.p_error_code == null || isText(args.p_error_code)) &&
      (args.p_outcome !== 'accepted' || isText(args.p_meta_message_id)); break;
  }
  return ok ? { valid: true, reason: 'static_payload_valid_only' } : { valid: false, reason: 'invalid_argument_value' };
}

// IMPORTANT: claim is a batch RPC (p_limit), not a claim-by-job-id RPC.
// Do not wire it to executeClaimedJob's claim(job) adapter without refactoring.
export const TRANSACTIONAL_INTEGRATION_STATUS = Object.freeze({
  execution_enabled: false,
  rpc_invocation_enabled: false,
  meta_sending_enabled: false,
  blocking_issue: 'claim_batch_vs_claim_by_job_contract_mismatch',
});
