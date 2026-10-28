// Composition of existing READ-ONLY endpoints. Does not invoke mutation RPCs.
import { GET as preflightGET } from '../chatbot-queue-preflight/route';
import { GET as reconciliationGET } from '../chatbot-reconciliation-readonly/route';
import { combineOrchestrationAudits } from '../../../../lib/chatbot/orchestration-audit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const respond = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return respond({ error: 'Unauthorized' }, 401);
  }
  try {
    // Calling handlers directly avoids passing credentials to any external endpoint.
    const preflightResponse = await preflightGET(request);
    if (!preflightResponse.ok) return respond({ error: 'Preflight unavailable', activation_ready: false }, 503);
    const reconciliationResponse = await reconciliationGET(request);
    if (!reconciliationResponse.ok) return respond({ error: 'Reconciliation unavailable', activation_ready: false }, 503);
    return respond(combineOrchestrationAudits(await preflightResponse.json(), await reconciliationResponse.json()));
  } catch (error) {
    console.error('orchestration_audit_failed', error?.message || 'unknown');
    return respond({ error: 'Orchestration audit unavailable', activation_ready: false }, 503);
  }
}

