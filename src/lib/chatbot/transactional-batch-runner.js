// Batch-to-single-job adapter for an ALREADY claimed queue batch.
// Pure dependency-injected module: importing it never calls Supabase or Meta.
// DO NOT connect to a production route until RPC adapters, lease expiry,
// reconciliation, and Meta send authorization have been reviewed.
import { executeClaimedJob } from './transactional-executor';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = value => typeof value === 'string' && UUID.test(value);
const failure = (reason, id = null) => ({ job_id: id, state: 'requires_reconciliation', reason, send_attempted: false });

// claimBatch(limit) is called exactly once, and MUST implement
// nexus_chatbot_inbound_claim({ p_limit: limit }). Its return rows contain
// {job_id, claim_token, organization_id, source_event_id}.
// loadJob(row) MUST load the full job by row.job_id and verify its tenant.
// jobAdapters MUST supply revalidate/reserve/humanPause/send/finalize/finish.
// This module intentionally supplies claim() locally, using the EXISTING lease;
// it never calls claim again for an individual job.
export async function processAlreadyClaimedBatch({ claimBatch, loadJob, jobAdapters, limit = 1 } = {}) {
  if (typeof claimBatch !== 'function' || typeof loadJob !== 'function' ||
      !jobAdapters || typeof jobAdapters !== 'object' ||
      !['revalidate', 'reserve', 'humanPause', 'send', 'finalize', 'finish']
        .every(name => typeof jobAdapters[name] === 'function') ||
      !Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error('invalid_batch_configuration');
  }
  const rows = await claimBatch(limit);
  if (!Array.isArray(rows) || rows.length > limit) {
    throw new Error('invalid_claim_batch_result_requires_manual_reconciliation');
  }
  const seen = new Set();
  const results = [];
  for (const row of rows) {
    const id = row?.job_id;
    if (!validId(id) || !validId(row?.claim_token) ||
        !validId(row?.organization_id) || !validId(row?.source_event_id) || seen.has(id)) {
      results.push(failure('invalid_or_duplicate_claim_row', validId(id) ? id : null));
      continue;
    }
    seen.add(id);
    try {
      const job = await loadJob(row);
      if (job?.id !== id || job?.organization_id !== row.organization_id ||
          job?.source_event_id !== row.source_event_id ||
          !validId(job?.id) || !job?.message_id || !job?.phone_number_id) {
        results.push(failure('claimed_job_identity_mismatch', id));
        continue;
      }
      // Claim is ALREADY held by the batch RPC; never claim a second time.
      const adapters = {
        ...jobAdapters,
        claim: async requested => {
          if (requested?.id !== id) throw new Error('claim_identity_mismatch');
          return { acquired: true, token: row.claim_token };
        },
      };
      const outcome = await executeClaimedJob(job, adapters);
      results.push({ job_id: id, ...outcome });
    } catch {
      // Do not finish or retry automatically: an ambiguous reservation or
      // external send may require operator reconciliation.
      results.push(failure('batch_job_exception_requires_manual_reconciliation', id));
    }
  }
  return { claimed: rows.length, results, automatic_retry_enabled: false };
}
