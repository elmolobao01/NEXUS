import { createDecipheriv } from 'node:crypto';
import { createTransactionalLiveAdapters } from './transactional-live-adapters.js';

// Resolve the verified credential before claiming any job or reserving credit.
async function resolveInstitutionalToken(organizationId, phoneNumberId) {
  if (organizationId !== '11de735a-4dfb-4b8d-b817-bda83d6df03a' ||
      phoneNumberId !== '1453993444467017') throw new Error('scope');
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = process.env.META_CREDENTIAL_ENCRYPTION_KEY;
  if (!base?.startsWith('https://') || !service || !/^[a-f0-9]{64}$/i.test(key || '')) throw new Error('configuration');
  const headers = {apikey:service, Authorization:`Bearer ${service}`};
  const lookup = async (table, params) => {
    const r = await fetch(`${base}/rest/v1/${table}?${new URLSearchParams(params)}`, {
      headers, cache:'no-store', redirect:'error', signal:AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error('lookup');
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('cardinality');
    return rows[0];
  };
  const c = await lookup('nexus_meta_whatsapp_connections', {
    select:'id,organization_id,phone_number_id,waba_id,connection_status,credential_reference',
    organization_id:`eq.${organizationId}`, phone_number_id:`eq.${phoneNumberId}`,
    connection_status:'eq.active', limit:'2',
  });
  if (c.id !== '2c05f573-edd5-48a6-8813-05dcbfbcd9f9' || c.organization_id !== organizationId ||
      c.phone_number_id !== phoneNumberId || c.waba_id !== '1494371125908048' ||
      c.connection_status !== 'active' || !/^[a-f0-9-]{36}$/i.test(c.credential_reference || '')) throw new Error('connection');
  const cred = await lookup('nexus_meta_oauth_credentials', {
    select:'id,organization_id,status,encrypted_token', id:`eq.${c.credential_reference}`,
    organization_id:`eq.${organizationId}`, status:'eq.verified', limit:'2',
  });
  if (cred.id !== c.credential_reference || cred.organization_id !== organizationId || cred.status !== 'verified') throw new Error('credential');
  const e = cred.encrypted_token;
  if (e?.algorithm !== 'aes-256-gcm' || !['iv','tag','ciphertext'].every(k=>typeof e[k] === 'string')) throw new Error('envelope');
  const iv = Buffer.from(e.iv,'base64'), tag = Buffer.from(e.tag,'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('envelope');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key,'hex'), iv);
  decipher.setAuthTag(tag);
  const token = Buffer.concat([decipher.update(Buffer.from(e.ciphertext,'base64')),decipher.final()]).toString('utf8');
  if (!token || token.length > 16384 || /\s/.test(token)) throw new Error('token');
  return token;
}

export async function runInstitutionalExecution() {
  // Independent, explicit operational approvals required. No default true values.
  if (process.env.CHATBOT_PILOT_EXECUTION_ENABLED !== 'true' ||
      process.env.CHATBOT_PILOT_FINANCIAL_MUTATIONS_APPROVED !== 'true' ||
      process.env.CHATBOT_PILOT_META_SENDS_APPROVED !== 'true')
    return {body:{mode:'pilot_locked',execution_enabled:false},status:423};
  const organizationId = process.env.CHATBOT_PILOT_ORGANIZATION_ID;
  const phoneNumberId = process.env.CHATBOT_PILOT_PHONE_NUMBER_ID;
  if (!organizationId || !phoneNumberId ||
      process.env.CHATBOT_INBOUND_QUEUE_ADMISSION_ENABLED !== 'true' ||
      !process.env.CHATBOT_INBOUND_ADMISSION_ALLOWED_PHONE_IDS?.split(',').map(x=>x.trim()).includes(phoneNumberId))
    return {body:{error:'pilot_scope_or_admission_not_configured'},status:423};
  let metaAccessToken;
  try {
    metaAccessToken = await resolveInstitutionalToken(organizationId, phoneNumberId);
  } catch {
    return {body:{error:'pilot_verified_credential_unavailable',execution_started:false},status:503};
  }
  try {
    const adapter = createTransactionalLiveAdapters({
      authorization:{approved:true,pilot:true,financial_mutations:true,meta_sends:true},
      organizationId, phoneNumberId, allowedPhoneNumberIds:[phoneNumberId],
      supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY,
      metaAccessToken,
      metaApiVersion:process.env.META_GRAPH_API_VERSION || 'v26.0',
    });
    const result = await adapter.runPilotBatch({limit:1});
    return {body:{mode:'controlled_pilot',...result},status:200};
  } catch {
    return {body:{error:'pilot_execution_failed_requires_operator_review',automatic_retry_enabled:false},status:500};
  }
}
