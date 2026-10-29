// Single-tenant, single-message execution endpoint. Disabled until explicit pilot approval.
// Never enable this route with Cron or a public client credential.
import { createTransactionalLiveAdapters } from '../../../../lib/chatbot/transactional-live-adapters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control':'no-store' };
const reply = (data,status) => Response.json(data,{status,headers:noStore});

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return reply({error:'Unauthorized'},401);
  // Explicitly retain the read-only GET contract: Cron GET never claims or sends.
  return reply({mode:'pilot_not_activated',execution_enabled:false,cron_execution_enabled:false},423);
}

export async function POST(request) {
  const secret = process.env.CHATBOT_PILOT_EXECUTION_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return reply({error:'Unauthorized'},401);
  // Independent, explicit operational approvals required. No default true values.
  if (process.env.CHATBOT_PILOT_EXECUTION_ENABLED !== 'true' ||
      process.env.CHATBOT_PILOT_FINANCIAL_MUTATIONS_APPROVED !== 'true' ||
      process.env.CHATBOT_PILOT_META_SENDS_APPROVED !== 'true')
    return reply({mode:'pilot_locked',execution_enabled:false},423);
  const organizationId = process.env.CHATBOT_PILOT_ORGANIZATION_ID;
  const phoneNumberId = process.env.CHATBOT_PILOT_PHONE_NUMBER_ID;
  if (!organizationId || !phoneNumberId ||
      process.env.CHATBOT_INBOUND_QUEUE_ADMISSION_ENABLED !== 'true' ||
      !process.env.CHATBOT_INBOUND_ADMISSION_ALLOWED_PHONE_IDS?.split(',').map(x=>x.trim()).includes(phoneNumberId))
    return reply({error:'pilot_scope_or_admission_not_configured'},423);
  try {
    const adapter = createTransactionalLiveAdapters({
      authorization:{approved:true,pilot:true,financial_mutations:true,meta_sends:true},
      organizationId, phoneNumberId, allowedPhoneNumberIds:[phoneNumberId],
      supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY,
      metaAccessToken:process.env.META_WHATSAPP_ACCESS_TOKEN,
      metaApiVersion:process.env.META_GRAPH_API_VERSION || 'v23.0',
    });
    const result = await adapter.runPilotBatch({limit:1});
    return reply({mode:'controlled_pilot',...result},200);
  } catch {
    return reply({error:'pilot_execution_failed_requires_operator_review',automatic_retry_enabled:false},500);
  }
}
