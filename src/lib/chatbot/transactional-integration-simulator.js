// Offline integration simulator for the EXISTING processAlreadyClaimedBatch.
// No credentials, network, database or Meta transport. Never import into a production cron.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const keyFor = job => `chatbot:inbound:${job.organization_id}:${job.phone_number_id}:${job.message_id}`;

export async function simulateTransactionalBatch(processAlreadyClaimedBatch, { rows, jobs, scenario = 'accepted' } = {}) {
  assert(typeof processAlreadyClaimedBatch === 'function', 'missing_batch_runner');
  assert(['accepted', 'rejected', 'uncertain', 'pause', 'invalid_contract', 'duplicate_reservation'].includes(scenario), 'invalid_scenario');
  assert(Array.isArray(rows) && Array.isArray(jobs) && rows.length <= 20, 'invalid_fixtures');
  const events = [];
  const reservations = new Set();
  const operations = new Map();
  const byId = new Map(jobs.map(job => [job.id, job]));
  const record = (type, data = {}) => { events.push({ type, ...data }); };
  const result = await processAlreadyClaimedBatch({
    limit: Math.max(1, rows.length),
    claimBatch: async limit => { record('claim_batch', { limit }); return rows; },
    loadJob: async row => { record('load_job', { job_id: row.job_id }); return byId.get(row.job_id) || null; },
    jobAdapters: {
      revalidate: async job => { record('revalidate', { job_id: job.id }); return scenario === 'invalid_contract' ? { allow: false, reason: 'contract_inactive' } : { allow: true, reply: 'Resposta simulada' }; },
      humanPause: async job => { record('human_pause', { job_id: job.id }); return scenario === 'pause' ? { allow: false, reason: 'human_pause' } : { allow: true }; },
      reserve: async (organizationId, key) => {
        record('reserve_simulated', { organization_id: organizationId, idempotency_key: key });
        if (scenario === 'duplicate_reservation' || reservations.has(key)) return { allowed: false, duplicate: true };
        const job = jobs.find(j => j.organization_id === organizationId && keyFor(j) === key);
        assert(job && UUID.test(job.id), 'unknown_reservation_key');
        reservations.add(key);
        operations.set(job.id, { status: 'reserved' });
        return { allowed: true, duplicate: false, status: 'reserved', operation_id: job.id };
      },
      send: async job => {
        record('meta_send_simulated', { job_id: job.id });
        if (scenario === 'rejected') return { outcome: 'rejected', error_code: 'synthetic_rejection' };
        if (scenario === 'uncertain') return { outcome: 'uncertain', error_code: 'synthetic_timeout' };
        return { outcome: 'accepted', meta_message_id: `synthetic-${job.message_id}` };
      },
      finalize: async (operationId, outcome, metaMessageId, errorCode) => {
        record('finalize_simulated', { operation_id: operationId, outcome });
        assert(operations.get(operationId)?.status === 'reserved', 'finalize_without_reservation');
        operations.set(operationId, { status: outcome, meta_message_id: metaMessageId, error_code: errorCode });
      },
      finish: async (jobId, token, state, reason) => {
        record('finish_simulated', { job_id: jobId, state, reason });
        assert(UUID.test(token), 'invalid_lease_token');
      },
    },
  });
  return {
    mode: 'offline_transactional_integration_simulation',
    scenario, result, events,
    simulated_operations: [...operations.entries()].map(([job_id, op]) => ({ job_id, ...op })),
    database_modified: false, rpc_invocations: 0, meta_requests: 0,
    wallet_modified: false, activation_ready: false,
  };
}
