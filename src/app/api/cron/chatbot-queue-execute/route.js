// Intentionally hard-locked. No code path in this route claims jobs, sends,
// reserves credits, or changes the database. Requires explicit authorization
// and a separate reviewed integration before it can be enabled.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return Response.json({
    mode: 'transactional_executor_locked',
    execution_enabled: false,
    meta_sending_enabled: false,
    wallet_reservation_enabled: false,
    jobs_claimed: false,
    database_modified: false,
    reason: 'requires_explicit_activation_and_adapter_review',
  }, { status: 423, headers: { 'Cache-Control': 'no-store' } });
}
