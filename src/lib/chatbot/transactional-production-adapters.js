// Production-bound Supabase reader for the transactional chatbot.
// Deliberately excludes claim, reserve, finalize, finish and Meta sending.
// The executor remains locked until explicit approval for financial/send actions.
import { selectChatbotReply } from './plan-response-router';
import { checkHumanPauseBeforeMetaSend } from './human-pause-send-guard';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGITS = /^\d{5,30}$/;
const PHONE = /^\d{7,20}$/;
const valid = j => UUID.test(j?.id || '') && UUID.test(j?.organization_id || '') &&
  UUID.test(j?.source_event_id || '') && DIGITS.test(j?.phone_number_id || '') &&
  PHONE.test(j?.contact_phone || '') && typeof j?.message_id === 'string' && j.message_id.length > 0;

export function createTransactionalProductionReader({
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl = fetch,
  pauseCheck = checkHumanPauseBeforeMetaSend,
} = {}) {
  if (!supabaseUrl || !serviceRoleKey || !supabaseUrl.startsWith('https://')) {
    throw new Error('supabase_reader_unavailable');
  }
  const base = supabaseUrl.replace(/\/$/, '');
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const read = async (table, params) => {
    const url = new URL(`${base}/rest/v1/${table}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const res = await fetchImpl(url.toString(), { method: 'GET', headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`read_${table}_${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length > 2) throw new Error(`invalid_${table}_rows`);
    return rows;
  };
  const one = async (table, params) => {
    const rows = await read(table, { ...params, limit: '2' });
    if (rows.length > 1) throw new Error(`ambiguous_${table}`);
    return rows[0] || null;
  };
  const contractActive = async (org, plan) => {
    const res = await fetchImpl(`${base}/rest/v1/rpc/nexus_chatbot_has_active_contract`, {
      method: 'POST', cache: 'no-store',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_organization_id: org, p_plan_code: plan }),
    });
    if (!res.ok) return false;
    return (await res.json()) === true;
  };
  const loadJob = async row => {
    if (!UUID.test(row?.job_id || '') || !UUID.test(row?.organization_id || '') ||
        !UUID.test(row?.source_event_id || '')) throw new Error('invalid_claim_identity');
    const job = await one('nexus_chatbot_inbound_jobs', {
      select: 'id,organization_id,phone_number_id,contact_phone,message_id,source_event_id,state',
      id: `eq.${row.job_id}`,
    });
    if (!job || !valid(job) || job.organization_id !== row.organization_id ||
        job.source_event_id !== row.source_event_id || job.state !== 'processing') {
      throw new Error('claimed_job_identity_mismatch');
    }
    return job;
  };
  const revalidate = async job => {
    if (!valid(job)) return { allow: false, reason: 'invalid_job_identity' };
    try {
      const org = `eq.${job.organization_id}`;
      const [event, connection, config, wallet, existing] = await Promise.all([
        one('nexus_whatsapp_webhook_events', {
          select: 'id,organization_id,phone_number_id,event_payload', id: `eq.${job.source_event_id}`,
        }),
        one('nexus_meta_whatsapp_connections', {
          select: 'organization_id,phone_number_id,connection_status,credential_reference',
          organization_id: org, phone_number_id: `eq.${job.phone_number_id}`,
        }),
        one('nexus_chatbot_configs', {
          select: 'active,welcome_message,closing_message,faq', organization_id: org,
        }),
        one('nexus_chatbot_message_wallets', {
          select: 'plan_code,cycle_start,cycle_end,included_remaining,prepaid_remaining', organization_id: org,
        }),
        one('nexus_chatbot_outbound_operations', {
          select: 'id,status', idempotency_key: `eq.chatbot:inbound:${job.organization_id}:${job.phone_number_id}:${job.message_id}`,
        }),
      ]);
      if (existing) return { allow: false, reason: 'outbound_operation_exists' };
      if (!event || event.organization_id !== job.organization_id ||
          event.phone_number_id !== job.phone_number_id) return { allow: false, reason: 'source_event_mismatch' };
      const messages = (event.event_payload?.entry || [])
        .flatMap(e => e.changes || [])
        .filter(c => c.field === 'messages' && c.value?.metadata?.phone_number_id === job.phone_number_id)
        .flatMap(c => c.value?.messages || [])
        .filter(m => m?.id === job.message_id && m?.from === job.contact_phone);
      if (messages.length !== 1) return { allow: false, reason: 'source_message_ambiguous' };
      if (!connection || connection.connection_status !== 'active' || !connection.credential_reference)
        return { allow: false, reason: 'connection_inactive' };
      if (!config?.active) return { allow: false, reason: 'chatbot_inactive' };
      if (!wallet || !['CHATBOT_BASIC', 'CHATBOT_AI'].includes(wallet.plan_code))
        return { allow: false, reason: 'wallet_missing' };
      if (!(await contractActive(job.organization_id, wallet.plan_code)))
        return { allow: false, reason: 'contract_inactive' };
      const today = new Date().toISOString().slice(0, 10);
      if (!(wallet.cycle_start <= today && today < wallet.cycle_end &&
        (wallet.included_remaining > 0 || wallet.prepaid_remaining > 0)))
        return { allow: false, reason: 'wallet_unavailable' };
      const message = messages[0];
      if (message.type !== 'text' || typeof message.text?.body !== 'string')
        return { allow: false, reason: 'unsupported_message_type' };
      // One response policy for both plans; Standard AI fallback remains
      // blocked until an atomic AI quota reservation is implemented.
      const result = await selectChatbotReply({
        planCode: wallet.plan_code, config, message: message.text.body,
      });
      if (result?.allow !== true) {
        return { allow: false, reason: result?.reason || 'response_unavailable' };
      }
      const pause = await pauseCheck({
        organizationId: job.organization_id,
        phoneNumberId: job.phone_number_id,
        contactPhone: job.contact_phone,
        fetchImpl, supabaseUrl: base, serviceRoleKey,
      });
      if (!pause?.allow) return { allow: false, reason: pause?.reason || 'human_pause_unavailable' };
      return { allow: true, reply: result.reply, response_type: result.type, response_engine: result.engine };
    } catch {
      return { allow: false, reason: 'revalidation_unavailable' };
    }
  };
  // No additional I/O. Uses the validated response, never invokes IA here.
  const selectReply = async (_job, validated) => {
    if (validated?.allow !== true || typeof validated.reply !== 'string' ||
        !validated.reply.trim() || !['rules', 'ai'].includes(validated.response_engine)) {
      return { allow: false, reason: 'validated_response_missing' };
    }
    return { allow: true, engine: validated.response_engine, reply: validated.reply };
  };
  return Object.freeze({ loadJob, revalidate, selectReply });
}

// No executable send/financial adapter is exported. Do not add write methods
// without an explicit activation decision and an end-to-end controlled pilot.
export const TRANSACTIONAL_PRODUCTION_EXECUTION_ENABLED = false;
