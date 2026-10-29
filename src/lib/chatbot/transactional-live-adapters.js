// Real transport adapters, deliberately NOT connected to a route or scheduler.
// Caller must inject authorization and secrets. Importing this file has no side effects.
import { createTransactionalProductionReader } from './transactional-production-adapters';
import { processAlreadyClaimedBatch } from './transactional-batch-runner';
import { validateChatbotRpcPayload } from './transactional-rpc-contract';
import { createScopedClaimBatch } from './scoped-claim-adapter';
import { checkHumanPauseBeforeMetaSend } from './human-pause-send-guard';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGITS = /^\d{7,20}$/;
const enabled = authorization => authorization?.approved === true && authorization?.pilot === true &&
  authorization?.financial_mutations === true && authorization?.meta_sends === true;

export function createTransactionalLiveAdapters({
  authorization, supabaseUrl, serviceRoleKey, fetchImpl = fetch,
  metaAccessToken, metaApiVersion = 'v23.0', allowedPhoneNumberIds = [], organizationId, phoneNumberId, pauseCheck,
} = {}) {
  // Fail closed at construction: no network or RPC call occurs here.
  if (!enabled(authorization)) throw new Error('explicit_pilot_authorization_required');
  if (!supabaseUrl?.startsWith('https://') || !serviceRoleKey || !metaAccessToken ||
      !/^v\d+\.\d+$/.test(metaApiVersion) || !Array.isArray(allowedPhoneNumberIds) ||
      !allowedPhoneNumberIds.length || !allowedPhoneNumberIds.every(x => /^\d{5,30}$/.test(x)) ||
      !UUID.test(organizationId || '') || !/^\d{5,30}$/.test(phoneNumberId || '') ||
      allowedPhoneNumberIds.length !== 1 || allowedPhoneNumberIds[0] !== phoneNumberId) {
    throw new Error('live_adapter_configuration_invalid');
  }
  const base = supabaseUrl.replace(/\/$/, '');
  const reader = createTransactionalProductionReader({ supabaseUrl, serviceRoleKey, fetchImpl, ...(pauseCheck ? {pauseCheck} : {}) });
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' };
  const rpc = async (operation, args) => {
    if (!validateChatbotRpcPayload(operation, args).valid) throw new Error(`invalid_${operation}_rpc_payload`);
    const names = { finish:'nexus_chatbot_inbound_finish',
      reserve:'nexus_chatbot_reserve_outbound', finalize:'nexus_chatbot_finalize_outbound' };
    const response = await fetchImpl(`${base}/rest/v1/rpc/${names[operation]}`, {
      method:'POST', headers, body:JSON.stringify(args), cache:'no-store',
    });
    if (!response.ok) throw new Error(`rpc_${operation}_${response.status}`);
    return response.json();
  };
  // Scoped RPC is the only claim path; the legacy global claim is never invoked.
  const scopedRpc = async (name, args) => {
    if (name !== 'nexus_chatbot_inbound_claim_scoped') throw new Error('unscoped_claim_forbidden');
    const response = await fetchImpl(`${base}/rest/v1/rpc/${name}`, {
      method:'POST', headers, body:JSON.stringify(args), cache:'no-store',
    });
    if (!response.ok) throw new Error(`rpc_scoped_claim_${response.status}`);
    return response.json();
  };
  const claimBatch = createScopedClaimBatch({ rpc:scopedRpc, organizationId, phoneNumberId });
  const humanPause = async job => {
    // Fresh validation immediately before reserve and send.
    if (job.organization_id !== organizationId || job.phone_number_id !== phoneNumberId)
      return { allow:false, reason:'pilot_scope_mismatch' };
    // Do NOT revalidate the wallet/outbound operation here: after reservation
    // the outbound operation necessarily exists, so that would block every send.
    const checked = await (pauseCheck || checkHumanPauseBeforeMetaSend)({
      organizationId:job.organization_id, phoneNumberId:job.phone_number_id,
      contactPhone:job.contact_phone, fetchImpl, supabaseUrl:base, serviceRoleKey,
    });
    return checked?.allow === true ? { allow:true } : { allow:false, reason:checked?.reason || 'human_pause_unavailable' };
  };
  const send = async (job, validated) => {
    if (job.organization_id !== organizationId || job.phone_number_id !== phoneNumberId ||
        !allowedPhoneNumberIds.includes(job.phone_number_id) || !DIGITS.test(job.contact_phone) ||
        typeof validated?.selected_reply !== 'string' || !validated.selected_reply.trim() ||
        validated.selected_reply.length > 4096) return { outcome:'rejected', error_code:'invalid_send_payload' };
    // A timeout or malformed response is uncertain: NEVER retry automatically.
    const response = await fetchImpl(`https://graph.facebook.com/${metaApiVersion}/${job.phone_number_id}/messages`, {
      method:'POST', cache:'no-store', headers:{ Authorization:`Bearer ${metaAccessToken}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ messaging_product:'whatsapp', to:job.contact_phone, type:'text',
        text:{ body:validated.selected_reply, preview_url:false } }),
    });
    const data = await response.json().catch(()=>null);
    const metaId = data?.messages?.[0]?.id;
    if (response.ok && typeof metaId === 'string' && metaId) return { outcome:'accepted', meta_message_id:metaId };
    // Meta HTTP errors are not assumed safe to retry or refund automatically.
    return { outcome:'uncertain', error_code:`meta_http_${response.status}` };
  };
  const jobAdapters = {
    revalidate: async job => {
      if (job.organization_id !== organizationId || job.phone_number_id !== phoneNumberId)
        return { allow:false, reason:'pilot_scope_mismatch' };
      return reader.revalidate(job);
    },
    selectReply:reader.selectReply, humanPause,
    reserve: async (org,key) => rpc('reserve',{p_organization_id:org,p_idempotency_key:key}),
    finalize: async (id,outcome,metaId,errorCode) => rpc('finalize',{p_operation_id:id,p_outcome:outcome,p_meta_message_id:metaId,p_error_code:errorCode}),
    finish: async (id,token,state,reason) => rpc('finish',{p_job_id:id,p_claim_token:token,p_state:state,p_reason:reason}),
    send,
  };
  const runPilotBatch = async ({ limit = 1 } = {}) => {
    if (!Number.isInteger(limit) || limit !== 1) throw new Error('pilot_limit_must_be_one');
    return processAlreadyClaimedBatch({ claimBatch: () => claimBatch(limit),
      loadJob:reader.loadJob, jobAdapters, limit });
  };
  return Object.freeze({ runPilotBatch });
}
