import { basicReply } from "../../portal/chatbot/basic-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

// Safe inspection only: no database mutations, Meta sends or wallet debits.
// Production sending requires atomic event claiming, tenant-specific credential
// retrieval, delivery reconciliation and refund semantics first.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "Unauthorized" }, 401);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return json({ error: "Service unavailable" }, 503);
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const rest = (table, query) => `${base}/rest/v1/${table}?${query}`;
  const get = async (url) => {
    const r = await fetch(url, { headers, cache: "no-store" });
    if (!r.ok) throw new Error(`read_failed_${r.status}`);
    return r.json();
  };
  try {
    const events = await get(rest("nexus_whatsapp_webhook_events", "select=id,organization_id,phone_number_id,event_payload&processing_status=eq.received&order=received_at.asc&limit=50"));
    if (!Array.isArray(events)) throw new Error("invalid_events");
    const tenants = new Map();
    const decisions = [];
    for (const event of events) {
      const org = event.organization_id;
      if (!org) { decisions.push({ event_id: event.id, reason: "missing_organization" }); continue; }
      if (!tenants.has(org)) {
        const encoded = encodeURIComponent(org);
        const [connections, configs, wallets, entitlement] = await Promise.all([
          get(rest("nexus_meta_whatsapp_connections", `select=phone_number_id,connection_status,credential_reference&organization_id=eq.${encoded}`)),
          get(rest("nexus_chatbot_configs", `select=active,welcome_message,closing_message,faq&organization_id=eq.${encoded}&limit=1`)),
          get(rest("nexus_chatbot_message_wallets", `select=plan_code,cycle_start,cycle_end,included_remaining,prepaid_remaining&organization_id=eq.${encoded}&limit=1`)),
          (async () => {
            const r = await fetch(`${base}/rest/v1/rpc/nexus_chatbot_entitlement`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ p_organization_id: org }), cache: "no-store" });
            if (!r.ok) throw new Error(`entitlement_failed_${r.status}`);
            return r.json();
          })(),
        ]);
        tenants.set(org, { connections, config: configs?.[0], wallet: wallets?.[0], entitlement });
      }
      const { connections, config, wallet, entitlement } = tenants.get(org);
      const linked = Array.isArray(connections) && connections.some(c => c.phone_number_id === event.phone_number_id && c.connection_status === "active" && c.credential_reference);
      const today = new Date().toISOString().slice(0, 10);
      const validWallet = wallet && wallet.plan_code === entitlement && wallet.cycle_start <= today && today < wallet.cycle_end && (wallet.included_remaining > 0 || wallet.prepaid_remaining > 0);
      const changes = event.event_payload?.entry?.flatMap(e => Array.isArray(e.changes) ? e.changes : []) || [];
      const messages = changes.flatMap(c => Array.isArray(c.value?.messages) ? c.value.messages : []);
      if (!messages.length) { decisions.push({ event_id: event.id, reason: "no_incoming_messages" }); continue; }
      for (const message of messages.slice(0, 20)) {
        const body = message?.type === "text" ? message.text?.body : null;
        const result = typeof body === "string" ? basicReply(config, body) : null;
        const reason = !linked ? "connection_not_active" : !["CHATBOT_BASIC", "CHATBOT_AI"].includes(entitlement) ? "contract_inactive" : !config?.active ? "chatbot_inactive" : !validWallet ? "wallet_unavailable" : !body ? "unsupported_message_type" : !result?.reply ? "no_rule_reply" : "eligible_for_future_processor";
        decisions.push({ event_id: event.id, message_id_present: Boolean(message?.id), reason, response_type: result?.type || null });
      }
    }
    return json({ mode: "dry_run", sending_enabled: false, database_modified: false, credits_debited: false, events_scanned: events.length, decisions });
  } catch (error) {
    console.error("chatbot_inbound_dry_run_failed", error?.message || "unknown");
    return json({ error: "Inbound inspection unavailable" }, 503);
  }
}
