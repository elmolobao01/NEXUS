import test from 'node:test';
import assert from 'node:assert/strict';
import { processAlreadyClaimedBatch } from '../src/lib/chatbot/transactional-batch-runner.js';
import { simulateTransactionalBatch } from '../src/lib/chatbot/transactional-integration-simulator.js';
  const job = { id: '11111111-1111-4111-8111-111111111111', organization_id: '22222222-2222-4222-8222-222222222222', source_event_id: '33333333-3333-4333-8333-333333333333', message_id: 'wamid.test', phone_number_id: '1295394797000036' };
  const row = { job_id: job.id, organization_id: job.organization_id, source_event_id: job.source_event_id, claim_token: '44444444-4444-4444-8444-444444444444' };

  for (const [scenario, expected, sendCount] of [
    ['accepted','completed',1], ['rejected','blocked',1], ['uncertain','blocked',1],
    ['pause','blocked',0], ['invalid_contract','blocked',0], ['duplicate_reservation','blocked',0],
  ]) {
    test('offline transaction: '+scenario, async()=>{
    const run = await simulateTransactionalBatch(processAlreadyClaimedBatch, { rows: [row], jobs: [job], scenario });
    assert.equal(run.result.results[0].state, expected, scenario);
    assert.equal(run.events.filter(e => e.type === 'meta_send_simulated').length, sendCount, scenario);
    assert.equal(run.events.filter(e => e.type === 'claim_batch').length, 1, scenario);
    assert.equal(run.database_modified, false); assert.equal(run.meta_requests, 0); assert.equal(run.rpc_invocations, 0);
    if (scenario === 'uncertain') assert.equal(run.simulated_operations[0].status, 'uncertain');
    assert.equal(run.events.filter(e => e.type === 'select_reply').length, scenario === 'invalid_contract' ? 0 : 1);
    });
  }
  test('offline transaction: tenant mismatch',async()=>{
  const mismatch = await simulateTransactionalBatch(processAlreadyClaimedBatch, { rows: [{ ...row, organization_id: '55555555-5555-4555-8555-555555555555' }], jobs: [job] });
  assert.equal(mismatch.result.results[0].state, 'requires_reconciliation');
  assert.equal(mismatch.events.filter(e => e.type === 'reserve_simulated').length, 0);
  });

