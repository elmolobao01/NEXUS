import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// Temporary ESM copies resolve the project's Next.js extensionless import in Node.
const root = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plenium-chatbot-offline-'));
try {
  const read = p => fs.readFileSync(path.join(root, p), 'utf8');
  fs.writeFileSync(path.join(tmp, 'transactional-executor.mjs'), read('src/lib/chatbot/transactional-executor.js'));
  fs.writeFileSync(path.join(tmp, 'transactional-batch-runner.mjs'), read('src/lib/chatbot/transactional-batch-runner.js').replace("'./transactional-executor'", "'./transactional-executor.mjs'"));
  fs.writeFileSync(path.join(tmp, 'simulator.mjs'), read('src/lib/chatbot/transactional-integration-simulator.js'));
  const { processAlreadyClaimedBatch } = await import(pathToFileURL(path.join(tmp, 'transactional-batch-runner.mjs')));
  const { simulateTransactionalBatch } = await import(pathToFileURL(path.join(tmp, 'simulator.mjs')));
  const job = { id: '11111111-1111-4111-8111-111111111111', organization_id: '22222222-2222-4222-8222-222222222222', source_event_id: '33333333-3333-4333-8333-333333333333', message_id: 'wamid.test', phone_number_id: '1295394797000036' };
  const row = { job_id: job.id, organization_id: job.organization_id, source_event_id: job.source_event_id, claim_token: '44444444-4444-4444-8444-444444444444' };
  let count = 0;
  for (const [scenario, expected, sendCount] of [
    ['accepted','completed',1], ['rejected','blocked',1], ['uncertain','blocked',1],
    ['pause','blocked',0], ['invalid_contract','blocked',0], ['duplicate_reservation','blocked',0],
  ]) {
    const run = await simulateTransactionalBatch(processAlreadyClaimedBatch, { rows: [row], jobs: [job], scenario });
    assert.equal(run.result.results[0].state, expected, scenario);
    assert.equal(run.events.filter(e => e.type === 'meta_send_simulated').length, sendCount, scenario);
    assert.equal(run.events.filter(e => e.type === 'claim_batch').length, 1, scenario);
    assert.equal(run.database_modified, false); assert.equal(run.meta_requests, 0); assert.equal(run.rpc_invocations, 0);
    if (scenario === 'uncertain') assert.equal(run.simulated_operations[0].status, 'uncertain');
    count++;
  }
  const mismatch = await simulateTransactionalBatch(processAlreadyClaimedBatch, { rows: [{ ...row, organization_id: '55555555-5555-4555-8555-555555555555' }], jobs: [job] });
  assert.equal(mismatch.result.results[0].state, 'requires_reconciliation');
  assert.equal(mismatch.events.filter(e => e.type === 'reserve_simulated').length, 0);
  count++;
  console.log(`${count} offline transactional integration scenarios passed; no RPC, Meta or database calls.`);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
