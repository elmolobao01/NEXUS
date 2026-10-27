import { basicReply } from "../../../portal/chatbot/basic-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const respond = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!base || !pub || !service) return respond({ error: "Service unavailable" }, 503);
  if (!token) return respond({ error: "Unauthorized" }, 401);
  try {
    const input = await request.json();
    if (!uuid.test(input?.organization_id || "") || typeof input?.message !== "string" || input.message.length > 1000)
      return respond({ error: "Invalid input" }, 400);
    const user = { apikey: pub, Authorization: `Bearer ${token}` };
    const admin = { apikey: service, Authorization: `Bearer ${service}` };
    const identity = await fetch(`${base}/auth/v1/user`, { headers: user, cache: "no-store" });
    if (!identity.ok) return respond({ error: "Unauthorized" }, 401);
    const who = await identity.json();
    if (!who?.id) return respond({ error: "Unauthorized" }, 401);
    const profile = await fetch(`${base}/rest/v1/nexus_user_profiles?select=profile,active&user_id=eq.${encodeURIComponent(who.id)}&active=eq.true`, { headers: admin, cache: "no-store" });
    if (!profile.ok) return respond({ error: "Authorization unavailable" }, 503);
    const profiles = await profile.json();
    if (!Array.isArray(profiles) || !profiles.some(x => x.profile === "NEXUS_ROOT" && x.active === true))
      return respond({ error: "Forbidden" }, 403);
    // Independent tenant-scoped eligibility preview. No inbound event is claimed.
    const org = encodeURIComponent(input.organization_id);
    const rest = (table, select, extra = "") => `${base}/rest/v1/${table}?organization_id=eq.${org}&select=${select}${extra}`;
    const get = async (url) => {
      const r = await fetch(url, { headers: admin, cache: "no-store" });
      if (!r.ok) throw new Error(`read_${r.status}`);
      const data = await r.json();
      if (!Array.isArray(data)) throw new Error("unexpected_rows");
      return data;
    };
    const [configs, wallets, connections, operations, pauses, clients] = await Promise.all([
      get(rest("nexus_chatbot_configs", "active,welcome_message,closing_message,faq", "&limit=2")),
      get(rest("nexus_chatbot_message_wallets", "plan_code,cycle_start,cycle_end,included_remaining,prepaid_remaining", "&limit=2")),
      get(rest("nexus_meta_whatsapp_connections", "phone_number_id,connection_status,credential_reference", "&limit=100")),
      get(rest("nexus_chatbot_outbound_operations", "status", "&status=in.(reserved,uncertain)&limit=1000")),
      get(rest("nexus_chatbot_human_pauses", "phone_number_id,contact_phone,pause_until", "&limit=1000")),
      get(rest("nexus_clients", "id,status", "&limit=101"))
    ]);
    if (clients.length >= 101) return respond({ error: "Client audit truncated" }, 503);
    const clientIds = clients.map(c => c.id);
    const contracts = clientIds.length ? await get(`${base}/rest/v1/nexus_contracts?select=id,client_id,status,start_date,end_date&client_id=in.(${clientIds.join(",")})&limit=501`) : [];
    if (contracts.length >= 501) return respond({ error: "Contract audit truncated" }, 503);
    const contractIds = contracts.map(c => c.id);
    const items = contractIds.length ? await get(`${base}/rest/v1/nexus_contract_items?select=contract_id,product_id&contract_id=in.(${contractIds.join(",")})&limit=1001`) : [];
    if (items.length >= 1001) return respond({ error: "Contract items truncated" }, 503);
    const productIds = [...new Set(items.map(i => i.product_id))];
    const products = productIds.length ? await get(`${base}/rest/v1/nexus_products?select=id,code,active&id=in.(${productIds.join(",")})&limit=1001`) : [];
    if (products.length !== productIds.length) return respond({ error: "Product audit incomplete" }, 503);
    const productById = new Map(products.map(p => [p.id, p]));
    const codesByContract = new Map();
    for (const item of items) {
      const p = productById.get(item.product_id);
      if (!p) return respond({ error: "Product reference missing" }, 503);
      if (p.active === true && ["CHATBOT_BASIC", "CHATBOT_AI"].includes(p.code)) {
        const codes = codesByContract.get(item.contract_id) || new Set();
        codes.add(p.code);
        codesByContract.set(item.contract_id, codes);
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const clientById = new Map(clients.map(c => [c.id, c]));
    const eligibleContracts = contracts.filter(c => {
      const client = clientById.get(c.client_id);
      return client && String(client.status).toLowerCase() === "active" &&
        ["active", "ativo"].includes(String(c.status).toLowerCase()) &&
        c.start_date && c.start_date <= today && (!c.end_date || c.end_date >= today);
    });
    const basicContracts = eligibleContracts.filter(c => codesByContract.get(c.id)?.has("CHATBOT_BASIC"));
    const standardContracts = eligibleContracts.filter(c => codesByContract.get(c.id)?.has("CHATBOT_AI"));
    const entitlement = basicContracts.length === 1 && standardContracts.length === 0 ? "CHATBOT_BASIC" :
      standardContracts.length === 1 && basicContracts.length === 0 ? "CHATBOT_AI" : "NONE";
    if (configs.length > 1 || wallets.length > 1 || operations.length >= 1000 || pauses.length >= 1000 || connections.length >= 100)
      return respond({ error: "Ambiguous or truncated tenant data" }, 503);
    const config = configs[0] || null;
    const wallet = wallets[0] || null;
    const rule = basicReply(config, input.message);
    const planValid = ["CHATBOT_BASIC", "CHATBOT_AI"].includes(entitlement);
    const walletValid = Boolean(wallet && wallet.plan_code === entitlement && wallet.cycle_start <= today && today < wallet.cycle_end && Number(wallet.included_remaining || 0) + Number(wallet.prepaid_remaining || 0) > 0);
    const linked = connections.filter(c => c.connection_status === "active" && Boolean(c.credential_reference));
    const blockers = [];
    if (!planValid) blockers.push("contract_inactive");
    if (!config?.active) blockers.push("chatbot_inactive");
    if (!walletValid) blockers.push("wallet_unavailable");
    if (linked.length !== 1) blockers.push(linked.length ? "ambiguous_active_connections" : "connection_not_active");
    if (operations.length) blockers.push("pending_outbound_operations_review");
    const contact = typeof input.contact_phone === "string" && /^\d{8,20}$/.test(input.contact_phone) ? input.contact_phone : null;
    const selectedPhone = linked.length === 1 ? linked[0].phone_number_id : null;
    if (contact && selectedPhone) {
      const activePause = pauses.some(p => p.phone_number_id === selectedPhone && p.contact_phone === contact && Number.isFinite(Date.parse(p.pause_until)) && Date.parse(p.pause_until) > Date.now());
      if (activePause) blockers.push("human_pause_active");
    } else blockers.push("human_pause_not_verified");
    if (!["welcome", "closing", "faq", "fallback"].includes(rule.type) || !rule.reply) blockers.push("no_usable_reply");
    // Even with no blockers, a preview cannot establish inbound idempotency or Meta delivery.
    return respond({
      mode: "tenant_processing_preview_read_only", organization_id: input.organization_id,
      plan: planValid ? entitlement : "NONE", contract_counts: { active_basic: basicContracts.length, active_standard: standardContracts.length }, engine: "deterministic_basic",
      response_type: rule.type, suggested_reply: rule.reply,
      gates: { contract_valid: planValid, config_active: config?.active === true,
        wallet_valid: walletValid, connection_count: linked.length,
        pending_outbound_operations: operations.length,
        human_pause_checked: Boolean(contact && selectedPhone) },
      blockers, eligible_for_future_processing: blockers.length === 0,
      production_ready: false,
      limitations: ["No persisted inbound event or cross-event idempotency check", "No Meta send or delivery check", "No wallet reservation", "Standard AI not invoked"],
      sending_enabled: false, database_modified: false, credits_debited: false, meta_called: false, ai_called: false
    });
  } catch (error) {
    console.error("tenant_processing_preview_failed", error?.message || "unknown");
    return respond({ error: "Processing preview unavailable" }, 503);
  }
}
