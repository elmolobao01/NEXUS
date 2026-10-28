// Pure safety classifier. No DB, RPC, network, timers, or Meta calls.
// Decisions are advisory: a production adapter must independently check the
// persisted lease token, lease expiry, financial operation, and Meta outcome.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = new Set(['pending', 'processing', 'completed', 'blocked', 'failed']);
const OPS = new Set(['reserved', 'accepted', 'rejected', 'uncertain']);
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const decision = (code, overrides = {}) => Object.freeze({
  code, safe_to_send: false, safe_to_reserve: false,
  auto_retry_allowed: false, requires_manual_reconciliation: true,
  ...overrides,
});

export function assessTransactionalRecovery({ job, operation = null, nowIso } = {}) {
  if (!job || !UUID.test(job.id || '') || !STATES.has(job.state) ||
      !validDate(nowIso) || !Number.isInteger(job.attempts) || job.attempts < 0) {
    return decision('invalid_recovery_input');
  }
  if (operation !== null && (!UUID.test(operation.id || '') ||
      !OPS.has(operation.status) || operation.organization_id !== job.organization_id)) {
    return decision('invalid_or_cross_tenant_operation');
  }
  if (operation?.status === 'accepted') return decision('accepted_delivery_no_resend', { requires_manual_reconciliation: false });
  if (operation?.status === 'uncertain') return decision('uncertain_meta_outcome_manual_reconciliation');
  if (operation?.status === 'reserved') return decision('reserved_credit_must_reconcile_before_retry');
  if (operation?.status === 'rejected') return decision('rejected_operation_requires_new_authorization');
  if (job.state === 'completed') return decision('completed_job_no_resend', { requires_manual_reconciliation: false });
  if (job.state === 'blocked' || job.state === 'failed') return decision('terminal_job_no_automatic_retry');
  if (job.state === 'processing') {
    if (!UUID.test(job.lease_token || '') || !validDate(job.leased_until)) {
      return decision('processing_lease_missing_or_invalid');
    }
    if (Date.parse(job.leased_until) > Date.parse(nowIso)) {
      return decision('active_lease_do_not_interfere', { requires_manual_reconciliation: false });
    }
    return decision('expired_lease_requires_operation_reconciliation');
  }
  // A pending job with no recorded outbound operation is not proven safe to
  // execute by this classifier. Existing admission/claim controls still apply.
  return decision('pending_requires_normal_claim_and_revalidation', {
    requires_manual_reconciliation: false,
  });
}

export function summarizeRecoveryDecisions(items) {
  if (!Array.isArray(items)) throw new Error('invalid_recovery_items');
  const counts = {};
  for (const item of items) {
    const code = typeof item?.code === 'string' ? item.code : 'invalid_decision';
    counts[code] = (counts[code] || 0) + 1;
  }
  return Object.freeze({ total: items.length, counts, automatic_actions: 0 });
}
