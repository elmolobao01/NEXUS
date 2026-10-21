import { basicReply } from "../../../portal/chatbot/basic-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!base || !pub || !service) return reply({ error: "Service unavailable" }, 503);
  if (!token) return reply({ error: "Unauthorized" }, 401);
  const userHeaders = { apikey: pub, Authorization: `Bearer ${token}` };
  const adminHeaders = { apikey: service, Authorization: `Bearer ${service}` };
  try {
    const identity = await fetch(`${base}/auth/v1/user`, { headers: userHeaders, cache: "no-store" });
    if (!identity.ok) return reply({ error: "Unauthorized" }, 401);
    const user = await identity.json();
    if (!user?.id) return reply({ error: "Unauthorized" }, 401);
    const membership = await fetch(`${base}/rest/v1/nexus_user_profiles?select=profile,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true`, { headers: adminHeaders, cache: "no-store" });
    if (!membership.ok) return reply({ error: "Authorization unavailable" }, 503);
    const profiles = await membership.json();
    if (!Array.isArray(profiles) || !profiles.some((p) => p.profile === "NEXUS_ROOT" && p.active === true)) return reply({ error: "Forbidden" }, 403);

    // Strictly read-only preview. Never call the debit, reserve, finalize or Meta send APIs.
    const eventsRes = await fetch(`${base}/rest/v1/nexus_whatsapp_webhook_events?select=organization_id,phone_number_id,processing_status,event_payload,received_at&order=received_at.desc&limit=20`, { headers: adminHeaders, cache: "no-store" });
    if (!eventsRes.ok) return reply({ error: "Events unavailable" }, 503);
    const events = await eventsRes.json();
    if (!Array.isArray(events)) return reply({ error: "Unexpected events response" }, 503);
    const organizations = [...new Set(events.map((e) => e.organization_id).filter(Boolean))];
    const results = [];
    for (const organizationId of organizations) {
      const org = encodeURIComponent(organizationId);
      const [configRes, walletRes, connectionRes, entitlementRes] = await Promise.all([
        fetch(`${base}/rest/v1/nexus_chatbot_configs?organization_id=eq.${org}&select=active,welcome_message,closing_message,faq&limit=1`, { headers: adminHeaders, cache: "no-store" }),
        fetch(`${base}/rest/v1/nexus_chatbot_message_wallets?organization_id=eq.${org}&select=plan_code,cycle_start,cycle_end,included_remaining,prepaid_remaining&limit=1`, { headers: adminHeaders, cache: "no-store" }),
        fetch(`${base}/rest/v1/nexus_meta_whatsapp_connections?organization_id=eq.${org}&select=phone_number_id,connection_status`, { headers: adminHeaders, cache: "no-store" }),
        fetch(`${base}/rest/v1/rpc/nexus_chatbot_entitlement`, { method: "POST", headers: { ...adminHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ p_organization_id: organizationId }), cache: "no-store" }),
      ]);
      if (![configRes, walletRes, connectionRes, entitlementRes].every((r) => r.ok)) return reply({ error: "Eligibility lookup failed" }, 503);
      const [configs, wallets, connections, plan] = await Promise.all([configRes.json(), walletRes.json(), connectionRes.json(), entitlementRes.json()]);
      const config = configs?.[0] || null;
      const wallet = wallets?.[0] || null;
      const today = new Date().toISOString().slice(0, 10);
      const walletValid = Boolean(wallet && wallet.plan_code === plan && wallet.cycle_start <= today && today < wallet.cycle_end && (wallet.included_remaining > 0 || wallet.prepaid_remaining > 0));
      for (const event of events.filter((e) => e.organization_id === organizationId)) {
        const changes = event.event_payload?.entry?.flatMap((entry) => entry?.changes || []) || [];
        const messages = changes.flatMap((change) => Array.isArray(change?.value?.messages) ? change.value.messages : []);
        const linked = Array.isArray(connections) && connections.some((c) => c.phone_number_id === event.phone_number_id && c.connection_status === "active");
        if (!messages.length) {
          results.push({ organization_id: organizationId, received_at: event.received_at, processing_status: event.processing_status, eligible: false, reason: "no_incoming_messages", count: 0 });
          continue;
        }
        for (const message of messages.slice(0, 20)) {
          const text = message?.type === "text" ? message?.text?.body : null;
          const rule = typeof text === "string" ? basicReply(config, text) : null;
          const reason = !linked ? "connection_not_active" : !["CHATBOT_BASIC", "CHATBOT_AI"].includes(plan) ? "contract_inactive" : !config?.active ? "chatbot_inactive" : !walletValid ? "wallet_unavailable" : !text ? "unsupported_message_type" : !rule?.reply ? "no_rule_reply" : "ready_for_future_processor";
          results.push({ organization_id: organizationId, received_at: event.received_at, processing_status: event.processing_status, message_type: message?.type || "unknown", response_type: rule?.type || null, plan: ["CHATBOT_BASIC", "CHATBOT_AI"].includes(plan) ? plan : "NONE", eligible: reason === "ready_for_future_processor", reason });
        }
      }
    }
    return reply({ mode: "read_only", sending_enabled: false, credits_debited: false, events_sampled: events.length, results });
  } catch {
    return reply({ error: "Processing preview unavailable" }, 503);
  }
}
