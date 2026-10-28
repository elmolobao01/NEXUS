import { assessReadOnlyTransaction } from '../../../../lib/chatbot/transactional-readiness-assessment.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (body, status=200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 10;
export async function GET(request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return reply({error:'Unauthorized'},401);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,'');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || !/^https:\/\//.test(base)) return reply({error:'Configuration unavailable'},503);
  const headers = {apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json'};
  const read = async (table, query) => {
    const response = await fetch(`${base}/rest/v1/${table}?${query}`, {method:'GET',headers,cache:'no-store',redirect:'error'});
    if (!response.ok) throw new Error(`read_${table}_${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('invalid_read_response');
    return rows;
  };
  const one = async (table, query) => {
    const rows = await read(table,`${query}&limit=2`);
    if (rows.length > 1) throw new Error(`ambiguous_${table}`);
    return rows[0] || null;
  };
  try {
    const org = new URL(request.url).searchParams.get('organization_id');
    if (org && !UUID.test(org)) return reply({error:'Invalid organization_id'},400);
    const orgFilter = org ? `&organization_id=eq.${org}` : '';
    const jobs = await read('nexus_chatbot_inbound_jobs',`select=id,organization_id,source_event_id,phone_number_id,contact_phone,message_id,state&state=eq.pending${orgFilter}&order=created_at.asc&limit=${MAX}`);
    const decisions = [];
    for (const job of jobs) {
      const invalid = !UUID.test(job.id || '') || !UUID.test(job.organization_id || '') || !UUID.test(job.source_event_id || '');
      if (invalid) { decisions.push({job_id:job.id || null,eligible_for_future_review:false,reason:'invalid_job_identity'}); continue; }
      const orgId = encodeURIComponent(job.organization_id);
      const [event,connection,config,wallet,pause,operation] = await Promise.all([
        one('nexus_whatsapp_webhook_events',`select=id,organization_id,phone_number_id,event_payload&id=eq.${job.source_event_id}`),
        one('nexus_meta_whatsapp_connections',`select=organization_id,phone_number_id,connection_status,credential_reference&organization_id=eq.${orgId}&phone_number_id=eq.${encodeURIComponent(job.phone_number_id || '')}`),
        one('nexus_chatbot_configs',`select=active&organization_id=eq.${orgId}`),
        one('nexus_chatbot_message_wallets',`select=plan_code,cycle_start,cycle_end,included_remaining,prepaid_remaining&organization_id=eq.${orgId}`),
        one('nexus_chatbot_human_pauses',`select=pause_until&organization_id=eq.${orgId}&phone_number_id=eq.${encodeURIComponent(job.phone_number_id || '')}&contact_phone=eq.${encodeURIComponent(job.contact_phone || '')}`),
        one('nexus_chatbot_outbound_operations',`select=id,status&idempotency_key=eq.${encodeURIComponent(`chatbot:inbound:${job.organization_id}:${job.phone_number_id}:${job.message_id}`)}`),
      ]);
      let contractActive = false;
      if (wallet?.plan_code && ['CHATBOT_BASIC','CHATBOT_AI'].includes(wallet.plan_code)) {
        // Existing service-role contract-check RPC is declared read-only.
        const response = await fetch(`${base}/rest/v1/rpc/nexus_chatbot_has_active_contract`,{
          method:'POST',headers:{...headers,'Content-Type':'application/json'},
          body:JSON.stringify({p_organization_id:job.organization_id,p_plan_code:wallet.plan_code}),cache:'no-store',redirect:'error'
        });
        if (!response.ok) throw new Error(`contract_check_${response.status}`);
        contractActive = (await response.json()) === true;
      }
      const decision = assessReadOnlyTransaction({job,event,connection,config,wallet,pause,operation,contractActive});
      decisions.push({job_id:job.id,...decision});
    }
    return reply({mode:'transactional_supabase_read_only',scanned:decisions.length,max_scanned:MAX,decisions,
      read_only_contract_rpc_invoked:true,mutation_rpcs_invoked:false,jobs_claimed:false,wallet_modified:false,
      meta_messages_sent:false,automatic_execution_authorized:false});
  } catch (error) {
    console.error('chatbot_transaction_readonly_failed',error?.message || 'unknown');
    return reply({error:'Read-only validation unavailable',automatic_execution_authorized:false},503);
  }
}
