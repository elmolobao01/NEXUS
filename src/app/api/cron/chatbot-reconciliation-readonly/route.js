// Read-only reconciliation report. Never claim jobs, reserve/finalize credits or call Meta.
import { assessTransactionalRecovery, summarizeRecoveryDecisions } from '../../../../lib/chatbot/transactional-reconciliation-guard.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const respond = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const MAX_JOBS = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return respond({ error: 'Unauthorized' }, 401);
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return respond({ error: 'Configuration unavailable' }, 503);
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' };
  const read = async path => {
    const response = await fetch(`${base}/rest/v1/${path}`, { method: 'GET', headers, cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error(`read_http_${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('unexpected_read_response');
    return data;
  };
  try {
    const params = new URL(request.url).searchParams;
    const org = params.get('organization_id');
    if (org && !UUID.test(org)) return respond({ error: 'Invalid organization_id' }, 400);
    const filter = org ? `&organization_id=eq.${org}` : '';
    const jobs = await read(`nexus_chatbot_inbound_jobs?select=id,organization_id,phone_number_id,message_id,state,attempts,lease_token,leased_until&state=in.(pending,processing,blocked,failed,completed)${filter}&order=created_at.desc&limit=${MAX_JOBS}`);
    const nowIso = new Date().toISOString();
    const decisions = [];
    for (const job of jobs) {
      // Stable key used by the isolated executor; lookup only, never invoke reserve RPC.
      const valid = UUID.test(job.organization_id || '') && typeof job.phone_number_id === 'string' && typeof job.message_id === 'string';
      const idempotencyKey = valid ? `chatbot:inbound:${job.organization_id}:${job.phone_number_id}:${job.message_id}` : null;
      let operation = null;
      let ambiguous = false;
      if (idempotencyKey) {
        const ops = await read(`nexus_chatbot_outbound_operations?select=id,organization_id,status&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=2`);
        if (ops.length > 1) ambiguous = true;
        else operation = ops[0] || null;
      }
      const assessment = ambiguous
        ? { code: 'ambiguous_outbound_operation', safe_to_send: false, safe_to_reserve: false, auto_retry_allowed: false, requires_manual_reconciliation: true }
        : assessTransactionalRecovery({ job, operation, nowIso });
      decisions.push({ job_id: job.id, state: job.state, operation_found: Boolean(operation), code: assessment.code,
        requires_manual_reconciliation: assessment.requires_manual_reconciliation, auto_retry_allowed: false });
    }
    return respond({ mode: 'persisted_reconciliation_read_only', scanned: decisions.length, max_scanned: MAX_JOBS,
      truncated_possible: decisions.length === MAX_JOBS, summary: summarizeRecoveryDecisions(decisions), decisions,
      jobs_claimed: false, rpc_mutations_invoked: false, wallet_modified: false, meta_sending_enabled: false,
      activation_ready: false });
  } catch (error) {
    console.error('chatbot_reconciliation_read_failed', error?.message || 'unknown');
    return respond({ error: 'Read-only reconciliation unavailable', activation_ready: false }, 503);
  }
}
