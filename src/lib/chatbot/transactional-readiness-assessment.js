// Pure, fail-closed decision. No I/O, writes or sending.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const okUuid = v => typeof v === 'string' && UUID.test(v);
export function assessReadOnlyTransaction({job, event, connection, config, wallet, operation, pause, contractActive, now = new Date().toISOString()}) {
  const deny = reason => ({ eligible_for_future_review: false, reason, automatic_execution_authorized: false });
  if (!job || !okUuid(job.id) || !okUuid(job.organization_id) || !okUuid(job.source_event_id) || !job.phone_number_id || !job.contact_phone || !job.message_id) return deny('invalid_job_identity');
  if (job.state !== 'pending') return deny('job_not_pending');
  if (operation) return deny('outbound_operation_already_exists');
  if (!event || event.id !== job.source_event_id || event.organization_id !== job.organization_id || event.phone_number_id !== job.phone_number_id) return deny('source_event_mismatch');
  const messages = (event.event_payload?.entry || []).flatMap(e => e.changes || []).filter(c => c.field === 'messages' && c.value?.metadata?.phone_number_id === job.phone_number_id).flatMap(c => c.value?.messages || []).filter(m => m?.id === job.message_id && m?.from === job.contact_phone);
  if (messages.length !== 1) return deny('source_message_not_unique');
  if (messages[0].type !== 'text' || typeof messages[0].text?.body !== 'string') return deny('unsupported_message');
  if (!connection || connection.organization_id !== job.organization_id || connection.phone_number_id !== job.phone_number_id || connection.connection_status !== 'active' || !connection.credential_reference) return deny('connection_unavailable');
  if (!config?.active) return deny('chatbot_inactive');
  if (!wallet || !['CHATBOT_BASIC', 'CHATBOT_AI'].includes(wallet.plan_code)) return deny('wallet_unavailable');
  if (contractActive !== true) return deny('contract_inactive');
  const date = now.slice(0, 10);
  if (!(wallet.cycle_start <= date && date < wallet.cycle_end && (Number(wallet.included_remaining) > 0 || Number(wallet.prepaid_remaining) > 0))) return deny('wallet_cycle_or_balance_invalid');
  if (!pause || pause.pause_until == null) return { eligible_for_future_review: true, reason: 'read_only_candidate', automatic_execution_authorized: false };
  if (typeof pause.pause_until !== 'string' || !Number.isFinite(Date.parse(pause.pause_until))) return deny('invalid_pause_state');
  if (Date.parse(pause.pause_until) > Date.parse(now)) return deny('human_pause_active');
  return { eligible_for_future_review: true, reason: 'read_only_candidate', automatic_execution_authorized: false };
}
