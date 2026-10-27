export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const respond = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request) {
  const url = new URL(request.url);
  const org = url.searchParams.get("organization_id");
  if (!org || !uuid.test(org)) return respond({ error: "Invalid organization_id" }, 400);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!base || !pub || !service) return respond({ error: "Service unavailable" }, 503);
  if (!token) return respond({ error: "Unauthorized" }, 401);
  const admin = { apikey: service, Authorization: `Bearer ${service}` };
  const user = { apikey: pub, Authorization: `Bearer ${token}` };
  try {
    const identity = await fetch(`${base}/auth/v1/user`, { headers: user, cache: "no-store" });
    if (!identity.ok) return respond({ error: "Unauthorized" }, 401);
    const who = await identity.json();
    if (!who?.id) return respond({ error: "Unauthorized" }, 401);
    const p = await fetch(`${base}/rest/v1/nexus_user_profiles?select=profile,active&user_id=eq.${encodeURIComponent(who.id)}&active=eq.true`, { headers: admin, cache: "no-store" });
    if (!p.ok) return respond({ error: "Authorization unavailable" }, 503);
    const profiles = await p.json();
    if (!Array.isArray(profiles) || !profiles.some(x => x.profile === "NEXUS_ROOT" && x.active === true))
      return respond({ error: "Forbidden" }, 403);

    const enc = encodeURIComponent(org);
    const query = (table, select, extra = "") => `${base}/rest/v1/${table}?organization_id=eq.${enc}&select=${select}${extra}`;
    const endpoints = [
      query("nexus_meta_whatsapp_connections", "phone_number_id,connection_status,credential_reference"),
      query("nexus_chatbot_configs", "active,faq", "&limit=1"),
      query("nexus_chatbot_message_wallets", "plan_code,cycle_start,cycle_end,included_remaining,prepaid_remaining", "&limit=1"),
      query("nexus_chatbot_outbound_operations", "status", "&limit=1000"),
      query("nexus_chatbot_human_pauses", "pause_until", "&limit=1000"),
      query("nexus_whatsapp_webhook_events", "processing_status,received_at", "&order=received_at.desc&limit=100")
    ];
    const responses = await Promise.all(endpoints.map(endpoint => fetch(endpoint, { headers: admin, cache: "no-store" })));
    if (!responses.every(r => r.ok)) return respond({ error: "Monitoring data unavailable" }, 503);
    const [connections, configs, wallets, ops, pauses, events] = await Promise.all(responses.map(r => r.json()));
    if (![connections, configs, wallets, ops, pauses, events].every(Array.isArray)) return respond({ error: "Invalid monitoring data" }, 503);
    // Fail closed on truncated safety-sensitive samples; no claims of zero pending operations.
    if (ops.length >= 1000 || pauses.length >= 1000) return respond({ error: "Monitoring sample limit reached" }, 503);
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const wallet = wallets[0] || null;
    const config = configs[0] || null;
    const statusCounts = ops.reduce((acc, x) => { acc[x.status] = (acc[x.status] || 0) + 1; return acc; }, {});
    const eventCounts = events.reduce((acc, x) => { const k = x.processing_status || "unknown"; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const alerts = [];
    if (!connections.some(x => x.connection_status === "active" && Boolean(x.credential_reference))) alerts.push("connection_not_active");
    if (config?.active !== true) alerts.push("chatbot_inactive");
    const faq = Array.isArray(config?.faq) ? config.faq : [];
    const validFaq = faq.filter(item => item && typeof item.question === "string" && item.question.trim() && typeof item.answer === "string" && item.answer.trim());
    if (config?.active === true && validFaq.length === 0) alerts.push("active_chatbot_without_faq");
    if (faq.length !== validFaq.length) alerts.push("faq_entries_invalid");
    if (!wallet) alerts.push("wallet_missing");
    else {
      if (!(wallet.cycle_start <= today && today < wallet.cycle_end)) alerts.push("wallet_cycle_inactive");
      if ((wallet.included_remaining || 0) + (wallet.prepaid_remaining || 0) <= 0) alerts.push("wallet_empty");
    }
    if ((statusCounts.uncertain || 0) > 0) alerts.push("outbound_uncertain_requires_reconciliation");
    if ((statusCounts.reserved || 0) > 0) alerts.push("outbound_reserved_review");
    return respond({
      mode: "root_client_monitor_read_only", organization_id: org,
      connections: connections.map(x => ({ phone_number_id: x.phone_number_id, status: x.connection_status, credential_linked: Boolean(x.credential_reference) })),
      chatbot: { configured: Boolean(config), active: config?.active === true, faq_entries: faq.length, valid_faq_entries: validFaq.length, faq_ready: validFaq.length > 0 },
      wallet: wallet ? { plan_code: wallet.plan_code, cycle_start: wallet.cycle_start, cycle_end: wallet.cycle_end, included_remaining: wallet.included_remaining, prepaid_remaining: wallet.prepaid_remaining } : { exists: false },
      outbound_operations: statusCounts,
      human_pauses: { total: pauses.length, active: pauses.filter(x => Number.isFinite(Date.parse(x.pause_until)) && Date.parse(x.pause_until) > now).length },
      recent_webhooks: { sampled: events.length, by_processing_status: eventCounts, last_received_at: events[0]?.received_at || null },
      alerts,
      diagnostics_complete: false,
      diagnostics_limitations: ["No Meta delivery verification", "Last 100 webhook events only", "Contract entitlement not evaluated", "No automatic remediation"],
      sending_enabled: false, database_modified: false, credits_debited: false, meta_called: false
    });
  } catch (e) {
    console.error("client_monitor_failed", e?.message || "unknown");
    return respond({ error: "Monitoring unavailable" }, 503);
  }
}
