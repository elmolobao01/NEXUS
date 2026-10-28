import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Load ESM source without requiring package.json type=module.
const source = await readFile(new URL('../src/lib/chatbot/transactional-reconciliation-guard.js', import.meta.url), 'utf8');
const { assessTransactionalRecovery, summarizeRecoveryDecisions } = await import('data:text/javascript,' + encodeURIComponent(source));
const id = '11111111-1111-4111-8111-111111111111';
const org = '22222222-2222-4222-8222-222222222222';
const base = { id, organization_id: org, state: 'processing', attempts: 1, lease_token: id, leased_until: '2026-10-28T12:05:00Z' };
const nowIso = '2026-10-28T12:10:00Z';
const assess = (job, operation = null) => assessTransactionalRecovery({ job, operation, nowIso });
for (const [name, job, operation, code] of [
  ['expired lease', base, null, 'expired_lease_requires_operation_reconciliation'],
  ['active lease', { ...base, leased_until: '2026-10-28T12:15:00Z' }, null, 'active_lease_do_not_interfere'],
  ['reserved', base, { id, organization_id: org, status: 'reserved' }, 'reserved_credit_must_reconcile_before_retry'],
  ['uncertain', base, { id, organization_id: org, status: 'uncertain' }, 'uncertain_meta_outcome_manual_reconciliation'],
  ['accepted', base, { id, organization_id: org, status: 'accepted' }, 'accepted_delivery_no_resend'],
  ['rejected', base, { id, organization_id: org, status: 'rejected' }, 'rejected_operation_requires_new_authorization'],
  ['cross tenant', base, { id, organization_id: id, status: 'reserved' }, 'invalid_or_cross_tenant_operation'],
  ['completed', { ...base, state: 'completed' }, null, 'completed_job_no_resend'],
  ['pending', { ...base, state: 'pending' }, null, 'pending_requires_normal_claim_and_revalidation'],
  ['invalid lease', { ...base, lease_token: null }, null, 'processing_lease_missing_or_invalid'],
]) {
  test(name, () => {
    const result = assess(job, operation);
    assert.equal(result.code, code);
    assert.equal(result.auto_retry_allowed, false);
    assert.equal(result.safe_to_send, false);
    assert.equal(result.safe_to_reserve, false);
  });
}
test('summary is read-only', () => assert.equal(summarizeRecoveryDecisions([assess(base)]).automatic_actions, 0));
