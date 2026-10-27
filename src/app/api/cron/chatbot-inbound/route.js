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
    // Authoritative persisted human-pause state, scoped to the homologation Meta phone.
    // Fail closed on database errors: never silently bypass an unavailable pause gate.
    const pauseRows = await get(rest(
      "nexus_chatbot_human_pauses",
      `select=organization_id,phone_number_id,contact_phone,last_human_at,pause_until&phone_number_id=eq.${encodeURIComponent(testPhoneId)}&limit=1000`
    ));
    if (!Array.isArray(pauseRows) || pauseRows.length >= 1000) {
      throw new Error("human_pause_state_unavailable_or_incomplete");
    }
    const pauseByContact = new Map();
    for (const pause of pauseRows) {
      if (!pause.organization_id || pause.phone_number_id !== testPhoneId ||
          typeof pause.contact_phone !== "string") continue;
      const untilMs = Date.parse(pause.pause_until);
      const atMs = Date.parse(pause.last_human_at);
      if (!Number.isFinite(untilMs) || !Number.isFinite(atMs) ||
          untilMs !== atMs + 30 * 60 * 1000) {
        throw new Error("human_pause_state_invalid");
      }
      pauseByContact.set(JSON.stringify([pause.organization_id, testPhoneId, pause.contact_phone]), untilMs);
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
        const pauseUntilMs = typeof message.from === "string"
          ? pauseByContact.get(JSON.stringify([org, event.phone_number_id, message.from]))
          : undefined;
        const pausedByHuman = Number.isFinite(pauseUntilMs) && Date.now() < pauseUntilMs;
        const reason = pausedByHuman ? "human_pause_30m" : !linked ? "connection_not_active" : !["CHATBOT_BASIC", "CHATBOT_AI"].includes(entitlement) ? "contract_inactive" : !config?.active ? "chatbot_inactive" : !validWallet ? "wallet_unavailable" : !body ? "unsupported_message_type" : !result?.reply ? "no_rule_reply" : "eligible_for_future_processor";
        decisions.push({ event_id: event.id, message_id_present: Boolean(message?.id), reason, response_type: result?.type || null });
      }
    }
    const reason_counts = decisions.reduce((acc, d) => {
      acc[d.reason] = (acc[d.reason] || 0) + 1;
      return acc;
    }, {});
    return json({ mode: "dry_run", scope: "single_homologation_phone", sending_enabled: false, database_modified: false, credits_debited: false, events_scanned: events.length, persisted_pause_records_scanned: pauseRows.length, pause_source: "nexus_chatbot_human_pauses", reason_counts, decisions });
  } catch (error) {
    console.error("chatbot_inbound_dry_run_failed", error?.message || "unknown");
    return json({ error: "Inbound inspection unavailable" }, 503);
  }
}
