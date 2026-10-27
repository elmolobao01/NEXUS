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
  // Explicit allowlist: homologation is restricted to one Meta phone ID.
  // Never process customer phones from this diagnostic route.
  const testPhoneId = process.env.CHATBOT_HOMOLOGATION_PHONE_NUMBER_ID;
  if (!testPhoneId || !/^\d{5,30}$/.test(testPhoneId)) return json({ error: "Homologation phone not configured" }, 503);
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
    // Real Meta coexistence echoes: read-only pause gate, restricted to the ROOT test phone.
    // Stored events are the durable source of truth; no additional pause table is required
    // for this dry-run. Query the last 30 minutes independently of inbound pagination.
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const echoes = await get(rest("nexus_whatsapp_webhook_events", `select=organization_id,phone_number_id,event_payload,received_at&phone_number_id=eq.${encodeURIComponent(testPhoneId)}&received_at=gte.${encodeURIComponent(cutoff)}&order=received_at.desc&limit=1000`));
    const lastHumanByContact = new Map();
    for (const event of echoes) {
      const changes = event.event_payload?.entry?.flatMap(e => Array.isArray(e.changes) ? e.changes : []) || [];
      for (const change of changes) {
        if (change?.field !== "smb_message_echoes") continue;
        if (change?.value?.metadata?.phone_number_id !== testPhoneId) continue;
        for (const echo of Array.isArray(change?.value?.message_echoes) ? change.value.message_echoes : []) {
          const contact = echo?.to;
          // Phone identifier only; do not log or expose it in diagnostic output.
          if (typeof contact !== "string" || !/^\d{7,20}$/.test(contact) || !echo?.id) continue;
          const timestamp = Number(echo.timestamp);
          // Meta timestamps are Unix seconds. Never use a future timestamp to pause.
          const eventMs = Number.isFinite(timestamp) && timestamp > 0 ? timestamp * 1000 : NaN;
          if (!Number.isFinite(eventMs) || eventMs > Date.now() + 60000 || eventMs < Date.now() - 30 * 60 * 1000) continue;
          const key = `${event.organization_id}:${contact}`;
          lastHumanByContact.set(key, Math.max(lastHumanByContact.get(key) || 0, eventMs));
        }
      }
    }
    const events = await get(rest("nexus_whatsapp_webhook_events", `select=id,organization_id,phone_number_id,event_payload&processing_status=eq.received&phone_number_id=eq.${encodeURIComponent(testPhoneId)}&order=received_at.asc&limit=50`));
    if (!Array.isArray(events)) throw new Error("invalid_events");
    const tenants = new Map();
    const decisions = [];
    const seenMessageIds = new Set();
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
        // One inbound message must never be processed twice, even if it appears
        // in multiple persisted webhook envelopes.
        if (!message?.id) {
          decisions.push({ event_id: event.id, reason: "missing_message_id" });
          continue;
        }
        if (seenMessageIds.has(message.id)) {
          decisions.push({ event_id: event.id, message_id_present: true, reason: "duplicate_message_id" });
          continue;
        }
        seenMessageIds.add(message.id);
        const body = message?.type === "text" ? message.text?.body : null;
        const result = typeof body === "string" ? basicReply(config, body) : null;
        const lastHumanMs = typeof message.from === "string" ? lastHumanByContact.get(`${org}:${message.from}`) : undefined;
        const pausedByHuman = Number.isFinite(lastHumanMs) && Date.now() < lastHumanMs + 30 * 60 * 1000;
        const reason = pausedByHuman ? "human_pause_30m" : !linked ? "connection_not_active" : !["CHATBOT_BASIC", "CHATBOT_AI"].includes(entitlement) ? "contract_inactive" : !config?.active ? "chatbot_inactive" : !validWallet ? "wallet_unavailable" : !body ? "unsupported_message_type" : !result?.reply ? "no_rule_reply" : "eligible_for_future_processor";
        decisions.push({ event_id: event.id, message_id_present: Boolean(message?.id), reason, response_type: result?.type || null });
      }
    }
    const reason_counts = decisions.reduce((acc, d) => {
      acc[d.reason] = (acc[d.reason] || 0) + 1;
      return acc;
    }, {});
    return json({ mode: "dry_run", scope: "single_homologation_phone", sending_enabled: false, database_modified: false, credits_debited: false, events_scanned: events.length, coexistence_echo_events_scanned: echoes.length, pause_source: "stored_meta_smb_message_echoes", reason_counts, decisions });
  } catch (error) {
    console.error("chatbot_inbound_dry_run_failed", error?.message || "unknown");
    return json({ error: "Inbound inspection unavailable" }, 503);
  }
}
