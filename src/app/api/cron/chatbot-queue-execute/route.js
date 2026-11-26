// Single-tenant, single-message execution endpoint. Disabled until explicit pilot approval.
// Never enable this route with Cron or a public client credential.
import { runInstitutionalExecution } from '../../../../lib/chatbot/institutional-execution';

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
  const result = await runInstitutionalExecution();
  return reply(result.body, result.status);
}
