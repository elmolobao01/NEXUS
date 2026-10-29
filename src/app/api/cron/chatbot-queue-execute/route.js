// Controlled one-message pilot. Existing GET remains permanently read-only.
// POST requires independently provisioned, explicit approval and credentials.
// This module never invokes the transport on import.
import { createTransactionalLiveAdapters } from '../../../../lib/chatbot/transactional-live-adapters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const locked = () => Response.json({
  mode: 'transactional_executor_locked', execution_enabled: false,
  meta_sending_enabled: false, wallet_reservation_enabled: false,
  jobs_claimed: false, database_modified: false,
  reason: 'requires_explicit_pilot_authorization',
}, { status: 423, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return locked();
}

export async function POST(request) {
  // Deliberately distinct from CRON_SECRET. Existing scheduled GET cannot execute.
  const secret = process.env.CHATBOT_PILOT_SECRET;
  if (!secret || secret.length < 32 ||
      request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const approved = process.env.CHATBOT_PILOT_APPROVED === 'true' &&
    process.env.CHATBOT_PILOT_FINANCIAL_MUTATIONS_APPROVED === 'true' &&
    process.env.CHATBOT_PILOT_META_SEND_APPROVED === 'true';
  if (!approved) return locked();
  // Current claim RPC is global, not phone-scoped. A pilot could otherwise
  // claim and block another tenant's job. Do not run until a scoped claim
  // RPC is implemented and reviewed. This is intentionally non-overridable.
  return locked();
}
