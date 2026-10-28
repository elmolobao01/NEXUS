// Read-only PostgREST contract discovery. No mutation RPC is ever invoked.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const REQUIRED = [
  'nexus_chatbot_inbound_claim',
  'nexus_chatbot_inbound_finish',
  'nexus_chatbot_has_active_contract',
  'nexus_chatbot_reserve_outbound',
  'nexus_chatbot_finalize_outbound',
];
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return reply({ error: 'Unauthorized' }, 401);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return reply({ error: 'Configuration unavailable' }, 503);
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' };
  try {
    const response = await fetch(`${base}/rest/v1/`, { method: 'GET', headers, cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error(`openapi_http_${response.status}`);
    const spec = await response.json();
    if (!spec || typeof spec.paths !== 'object' || !spec.paths) throw new Error('invalid_openapi_schema');
    const checks = REQUIRED.map(name => {
      const path = spec.paths[`/rpc/${name}`];
      const post = path?.post;
      return { function: name, advertised: Boolean(post), callable_method: post ? 'POST' : null };
    });
    return reply({ mode: 'transaction_rpc_discovery_read_only', checks,
      all_advertised: checks.every(c => c.advertised),
      note: 'OpenAPI visibility does not verify grants, runtime success, signatures, or transactional behavior.',
      mutation_rpcs_invoked: false, jobs_claimed: false, wallet_modified: false,
      meta_sending_enabled: false, activation_ready: false });
  } catch (error) {
    console.error('chatbot_transaction_readiness_failed', error?.message || 'unknown');
    return reply({ error: 'Read-only RPC discovery unavailable', mutation_rpcs_invoked: false }, 503);
  }
}
