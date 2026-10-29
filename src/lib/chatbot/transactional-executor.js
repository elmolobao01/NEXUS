// Transactional executor orchestration, intentionally disconnected from production.
// All I/O must be injected by a separately reviewed, authorized integration.
// No Supabase, Meta, or wallet operation is performed by importing this module.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const STOP = Object.freeze({ state: 'blocked', send_attempted: false });

export function validateExecutorAdapters(adapters) {
  for (const name of ['claim', 'revalidate', 'reserve', 'humanPause', 'send', 'finalize', 'finish']) {
    assert(typeof adapters?.[name] === 'function', `missing_adapter_${name}`);
  }
}

// Not called by any production route. Designed for controlled integration tests.
// A send is never retried automatically. Ambiguous Meta outcomes remain uncertain.
export async function executeClaimedJob(job, adapters) {
  validateExecutorAdapters(adapters);
  assert(UUID.test(job?.id || '') && UUID.test(job?.organization_id || ''), 'invalid_job');
  assert(typeof job.message_id === 'string' && job.message_id.length > 0, 'invalid_message');
  const claim = await adapters.claim(job);
  assert(claim?.acquired === true && UUID.test(claim?.token || ''), 'claim_not_acquired');
  const token = claim.token;
  let operationId = null;
  let attemptedSend = false;
  try {
    const validated = await adapters.revalidate(job);
    if (validated?.allow !== true) {
      await adapters.finish(job.id, token, 'blocked', validated?.reason || 'revalidation_blocked');
      return { ...STOP, reason: validated?.reason || 'revalidation_blocked' };
    }
    // Optional shared response selection; blocks before any credit reservation.
    if (adapters.selectReply !== undefined) {
      assert(typeof adapters.selectReply === 'function', 'invalid_select_reply_adapter');
      const selected = await adapters.selectReply(job, validated);
      if (selected?.allow !== true || typeof selected.reply !== 'string' ||
          !selected.reply.trim() || selected.reply.length > 4096 ||
          !['rules', 'ai'].includes(selected.engine)) {
        await adapters.finish(job.id, token, 'blocked', selected?.reason || 'reply_selection_blocked');
        return { ...STOP, reason: selected?.reason || 'reply_selection_blocked' };
      }
      validated.selected_reply = selected.reply;
      validated.response_engine = selected.engine;
    }
    // Mandatory pre-reservation pause gate.
    const firstPause = await adapters.humanPause(job);
    if (firstPause?.allow !== true) {
      await adapters.finish(job.id, token, 'blocked', firstPause?.reason || 'human_pause_blocked');
      return { ...STOP, reason: firstPause?.reason || 'human_pause_blocked' };
    }
    // Stable key is derived from immutable tenant + phone + inbound Meta ID.
    const key = `chatbot:inbound:${job.organization_id}:${job.phone_number_id}:${job.message_id}`;
    const reservation = await adapters.reserve(job.organization_id, key);
    if (reservation?.allowed !== true || reservation?.duplicate === true ||
        reservation?.status !== 'reserved' || !UUID.test(reservation?.operation_id || '')) {
      await adapters.finish(job.id, token, 'blocked', 'reservation_not_new');
      return { ...STOP, reason: 'reservation_not_new' };
    }
    operationId = reservation.operation_id;
    const secondPause = await adapters.humanPause(job);
    if (secondPause?.allow !== true) {
      await adapters.finalize(operationId, 'rejected', null, 'human_pause_before_send');
      await adapters.finish(job.id, token, 'blocked', secondPause?.reason || 'human_pause_before_send');
      return { ...STOP, reason: secondPause?.reason || 'human_pause_before_send' };
    }
    // Fail closed: mark as attempted BEFORE invoking external Meta transport.
    // The integration must reconcile any ambiguous outcome, never resend.
    attemptedSend = true;
    let delivery;
    try { delivery = await adapters.send(job, validated); }
    catch { delivery = { outcome: 'uncertain', error_code: 'transport_exception' }; }
    const outcome = delivery?.outcome === 'accepted' && typeof delivery.meta_message_id === 'string' && delivery.meta_message_id
      ? 'accepted' : delivery?.outcome === 'rejected' ? 'rejected' : 'uncertain';
    await adapters.finalize(operationId, outcome,
      outcome === 'accepted' ? delivery.meta_message_id : null,
      outcome === 'accepted' ? null : (delivery?.error_code || 'unconfirmed_meta_outcome'));
    await adapters.finish(job.id, token, outcome === 'accepted' ? 'completed' : 'blocked', `meta_${outcome}`);
    return { state: outcome === 'accepted' ? 'completed' : 'blocked', outcome, send_attempted: true };
  } catch (error) {
    // Never automatically refund or retry after any potentially ambiguous send.
    // If reserved and not yet sent, caller must reconcile reservation manually.
    return { state: 'requires_reconciliation', reason: error?.message || 'executor_error',
      operation_id: operationId, send_attempted: attemptedSend };
  }
}
