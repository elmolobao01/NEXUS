import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ORG = "7ca2ee92-6b12-4f54-ba7b-986bab2f9434";
const PHONE = "1295394797000036";
const respond = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const eqSecret = (provided, secret) => {
  if (!secret || !provided) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(provided);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
export async function GET(request) {
  if (!eqSecret(request.headers.get("authorization"), process.env.CRON_SECRET)) return respond({ error: "Unauthorized" }, 401);
  if (process.env.CHATBOT_HOMOLOGATION_ORGANIZATION_ID !== ORG || process.env.CHATBOT_HOMOLOGATION_PHONE_NUMBER_ID !== PHONE)
    return respond({ error: "Homologation scope not configured" }, 503);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return respond({ error: "Service unavailable" }, 503);
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const get = async (path) => {
    const r = await fetch(`${base}/rest/v1/${path}`, { headers, cache: "no-store" });
    if (!r.ok) throw new Error(`read_${r.status}`);
    return r.json();
  };
  try {
    const org = encodeURIComponent(ORG);
    const [wallets, connections, configs, entitlement, ledger] = await Promise.all([
      get(`nexus_chatbot_message_wallets?select=plan_code,cycle_start,cycle_end,included_remaining,prepaid_remaining&organization_id=eq.${org}&limit=2`),
      get(`nexus_meta_whatsapp_connections?select=phone_number_id,connection_status,credential_reference&organization_id=eq.${org}&phone_number_id=eq.${PHONE}&limit=2`),
      get(`nexus_chatbot_configs?select=active&organization_id=eq.${org}&limit=2`),
      (async () => {
        const r = await fetch(`${base}/rest/v1/rpc/nexus_chatbot_entitlement`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ p_organization_id: ORG }), cache: "no-store" });
        if (!r.ok) throw new Error(`entitlement_${r.status}`);
        return r.json();
      })(),
      get(`nexus_chatbot_outbound_sandbox?select=id,state,attempts,inbound_message_id&organization_id=eq.${org}&phone_number_id=eq.${PHONE}&limit=1000`),
    ]);
    if (![wallets, connections, configs, ledger].every(Array.isArray) || wallets.length > 1 || connections.length > 1 || configs.length > 1 || ledger.length >= 1000)
      throw new Error("inconsistent_or_truncated_state");
    const wallet = wallets[0];
    const plan = typeof entitlement === "string" ? entitlement : null;
    const today = new Date().toISOString().slice(0, 10);
    const validPlan = ["CHATBOT_BASIC", "CHATBOT_AI"].includes(plan);
    const validWallet = Boolean(wallet && validPlan && wallet.plan_code === plan &&
      typeof wallet.cycle_start === "string" && typeof wallet.cycle_end === "string" &&
      wallet.cycle_start <= today && today < wallet.cycle_end &&
      Number.isSafeInteger(wallet.included_remaining) && wallet.included_remaining >= 0 &&
      Number.isSafeInteger(wallet.prepaid_remaining) && wallet.prepaid_remaining >= 0);
    const activeConnection = connections.length === 1 && connections[0].connection_status === "active" && Boolean(connections[0].credential_reference);
    const activeConfig = configs.length === 1 && configs[0].active === true;
    const states = ledger.reduce((acc, row) => { acc[row.state] = (acc[row.state] || 0) + 1; return acc; }, {});
    const duplicateIds = ledger.length - new Set(ledger.map(row => row.inbound_message_id)).size;
    const readyForFutureIntegration = validWallet && activeConnection && activeConfig && duplicateIds === 0;
    return respond({ mode: "real_wallet_read_only_transaction_audit", scope: "root_phone_only",
      contract_plan: validPlan ? plan : "NONE", contract_active: validPlan,
      connection_active: Boolean(activeConnection), chatbot_active: activeConfig,
      wallet: { present: Boolean(wallet), cycle_valid: Boolean(validWallet),
        matches_contract: Boolean(wallet && wallet.plan_code === plan),
        included_remaining: validWallet ? wallet.included_remaining : null,
        prepaid_remaining: validWallet ? wallet.prepaid_remaining : null,
        total_remaining: validWallet ? wallet.included_remaining + wallet.prepaid_remaining : null },
      sandbox: { records: ledger.length, states, duplicate_message_ids: duplicateIds },
      ready_for_future_integration: Boolean(readyForFutureIntegration),
      sending_enabled: false, credits_reserved: false, credits_debited: false,
      database_modified: false, meta_called: false });
  } catch (error) {
    console.error("chatbot_wallet_transaction_audit_failed", error?.message || "unknown");
    return respond({ error: "Transaction audit unavailable", sending_enabled: false }, 503);
  }
}
