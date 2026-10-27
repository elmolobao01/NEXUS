export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const respond = (data, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!base || !pub || !service) return respond({ error: "Service unavailable" }, 503);
  if (!token) return respond({ error: "Unauthorized" }, 401);

  try {
    const userHeaders = { apikey: pub, Authorization: `Bearer ${token}` };
    const adminHeaders = { apikey: service, Authorization: `Bearer ${service}` };
    const identity = await fetch(`${base}/auth/v1/user`, {
      headers: userHeaders, cache: "no-store"
    });
    if (!identity.ok) return respond({ error: "Unauthorized" }, 401);
    const who = await identity.json();
    if (!who?.id) return respond({ error: "Unauthorized" }, 401);

    const profile = await fetch(
      `${base}/rest/v1/nexus_user_profiles?select=profile,active&user_id=eq.${encodeURIComponent(who.id)}&active=eq.true`,
      { headers: adminHeaders, cache: "no-store" }
    );
    if (!profile.ok) return respond({ error: "Authorization unavailable" }, 503);
    const profiles = await profile.json();
    if (!Array.isArray(profiles) ||
        !profiles.some(x => x.profile === "NEXUS_ROOT" && x.active === true)) {
      return respond({ error: "Forbidden" }, 403);
    }

    const org = new URL(request.url).searchParams.get("organization_id");
    if (!org || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(org)) {
      return respond({ error: "Invalid organization_id" }, 400);
    }
    const enc = encodeURIComponent(org);
    const read = async (table, select, extra = "") => {
      const response = await fetch(`${base}/rest/v1/${table}?organization_id=eq.${enc}&select=${select}${extra}`, {
        headers: adminHeaders, cache: "no-store"
      });
      if (!response.ok) throw new Error(`read_${table}_${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error(`invalid_${table}`);
      return rows;
    };
    const [connections, configs, wallets, operations, pauses] = await Promise.all([
      read("nexus_meta_whatsapp_connections", "phone_number_id,connection_status,credential_reference", "&limit=101"),
      read("nexus_chatbot_configs", "active,faq", "&limit=101"),
      read("nexus_chatbot_message_wallets", "plan_code,cycle_start,cycle_end,included_remaining,prepaid_remaining", "&limit=101"),
      read("nexus_chatbot_outbound_operations", "status", "&limit=1001"),
      read("nexus_chatbot_human_pauses", "pause_until", "&limit=1001")
    ]);
    if (connections.length >= 101 || configs.length >= 101 || wallets.length >= 101 || operations.length >= 1001 || pauses.length >= 1001) {
      return respond({ error: "Monitoring safety sample truncated" }, 503);
    }
    // Events are retrieved in pages, tenant-scoped. Do not return message bodies,
    // sender numbers, contact details, or full payloads to the browser.
    const pageSize = 500;
    const maxPages = 20;
    const byStatus = {};
    const byType = {};
    let sampled = 0;
    let lastReceived = null;
    let truncated = false;
    for (let page = 0; page < maxPages; page++) {
      const offset = page * pageSize;
      const rows = await read("nexus_whatsapp_webhook_events", "processing_status,received_at,event_payload", `&order=received_at.desc&limit=${pageSize}&offset=${offset}`);
      for (const row of rows) {
        sampled++;
        if (!lastReceived) lastReceived = row.received_at;
        const status = row.processing_status || "unknown";
        byStatus[status] = (byStatus[status] || 0) + 1;
        const value = row.event_payload?.entry?.[0]?.changes?.[0]?.value;
        const messageType = value?.messages?.[0]?.type;
        const type = typeof messageType === "string" ? messageType :
          Array.isArray(value?.statuses) ? "delivery_status" : "other_event";
        byType[type] = (byType[type] || 0) + 1;
      }
      if (rows.length < pageSize) break;
      if (page === maxPages - 1) truncated = true;
    }
    const countStatuses = (rows) => rows.reduce((out, row) => {
      const k = row.status || "unknown";
      out[k] = (out[k] || 0) + 1;
      return out;
    }, {});
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const wallet = wallets.length === 1 ? wallets[0] : null;
    const config = configs.length === 1 ? configs[0] : null;
    const faq = Array.isArray(config?.faq) ? config.faq : [];
    const validFaq = faq.filter(x => x && typeof x.question === "string" && x.question.trim() && typeof x.answer === "string" && x.answer.trim());
    const alerts = [];
    if (!connections.some(x => x.connection_status === "active" && Boolean(x.credential_reference))) alerts.push("connection_not_active");
    if (config?.active !== true) alerts.push("chatbot_inactive");
    if (config?.active === true && validFaq.length === 0) alerts.push("active_chatbot_without_faq");
    if (faq.length !== validFaq.length) alerts.push("faq_entries_invalid");
    if (!wallet) alerts.push(wallets.length > 1 ? "multiple_wallets_review" : "wallet_missing");
    else {
      if (!(wallet.cycle_start <= today && today < wallet.cycle_end)) alerts.push("wallet_cycle_inactive");
      if (Number(wallet.included_remaining || 0) + Number(wallet.prepaid_remaining || 0) <= 0) alerts.push("wallet_empty");
    }
    const opStatuses = countStatuses(operations);
    if (opStatuses.uncertain) alerts.push("outbound_uncertain_requires_reconciliation");
    if (opStatuses.reserved) alerts.push("outbound_reserved_review");
    if (truncated) alerts.push("webhook_count_truncated");
    return respond({
      mode: "root_tenant_monitor_read_only", organization_id: org,
      connections: connections.map(x => ({ phone_number_id: x.phone_number_id, status: x.connection_status, credential_linked: Boolean(x.credential_reference) })),
      chatbot: { configured: Boolean(config), active: config?.active === true, faq_entries: faq.length, valid_faq_entries: validFaq.length },
      wallet: wallet ? { plan_code: wallet.plan_code, cycle_start: wallet.cycle_start, cycle_end: wallet.cycle_end, included_remaining: wallet.included_remaining, prepaid_remaining: wallet.prepaid_remaining } : { exists: false },
      outbound_operations: opStatuses,
      human_pauses: { total: pauses.length, active: pauses.filter(x => Number.isFinite(Date.parse(x.pause_until)) && Date.parse(x.pause_until) > now).length },
      webhooks: { sampled, truncated, by_processing_status: byStatus, by_type: byType, last_received_at: lastReceived },
      alerts,
      limitations: ["No persistent processing claim verification", "No contract entitlement evaluation", "No Meta delivery verification", "No automatic remediation"],
      sending_enabled: false, database_modified: false, credits_debited: false, meta_called: false
    });
  } catch (error) {
    console.error("admin_tenant_monitor_failed", error?.message || "unknown");
    return respond({ error: "Inspection unavailable" }, 503);
  }
}
