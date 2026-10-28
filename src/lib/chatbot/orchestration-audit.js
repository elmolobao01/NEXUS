// Pure read-only join of preflight and persisted reconciliation. No I/O.
export function combineOrchestrationAudits(preflight, recovery) {
  if (preflight?.mode !== 'queue_preflight_read_only' ||
      recovery?.mode !== 'persisted_reconciliation_read_only' ||
      !Array.isArray(preflight.decisions) || !Array.isArray(recovery.decisions)) {
    throw new Error('invalid_audit_inputs');
  }
  const recoveryByJob = new Map();
  for (const r of recovery.decisions) {
    if (!r?.job_id || recoveryByJob.has(r.job_id)) throw new Error('ambiguous_recovery_job');
    recoveryByJob.set(r.job_id, r);
  }
  const decisions = preflight.decisions.map(p => {
    const r = recoveryByJob.get(p.job_id);
    const requiresReview = Boolean(r?.requires_manual_reconciliation || r?.operation_found);
    const preflightEligible = p.eligible === true && p.reason === 'preflight_eligible';
    return {
      job_id: p.job_id,
      preflight_reason: p.reason,
      recovery_code: r?.code || 'not_in_reconciliation_window',
      decision: requiresReview ? 'manual_reconciliation' : preflightEligible ? 'eligible_for_future_controlled_test' : 'not_eligible',
      executable: false,
      auto_retry_allowed: false,
    };
  });
  return {
    mode: 'orchestration_audit_read_only',
    jobs_scanned: preflight.jobs_scanned,
    reconciliation_scanned: recovery.scanned,
    reconciliation_truncated_possible: Boolean(recovery.truncated_possible),
    decisions,
    production_ready: false,
    claim_enabled: false,
    reserve_enabled: false,
    meta_sending_enabled: false,
    database_modified: false,
  };
}
