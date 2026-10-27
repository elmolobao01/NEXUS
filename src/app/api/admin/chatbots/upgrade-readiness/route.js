export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!base || !publicKey || !service) return json({ error: "Service unavailable" }, 503);
  if (!token) return json({ error: "Unauthorized" }, 401);
  const userHeaders = { apikey: publicKey, Authorization: `Bearer ${token}` };
  const adminHeaders = { apikey: service, Authorization: `Bearer ${service}` };
  try {
    const auth = await fetch(`${base}/auth/v1/user`, { headers: userHeaders, cache: "no-store" });
    if (!auth.ok) return json({ error: "Unauthorized" }, 401);
    const user = await auth.json();
    if (!user?.id) return json({ error: "Unauthorized" }, 401);
    const profileQuery = new URLSearchParams({ select: "profile,active", user_id: `eq.${user.id}`, active: "eq.true", limit: "20" });
    const profileResponse = await fetch(`${base}/rest/v1/nexus_user_profiles?${profileQuery}`, { headers: adminHeaders, cache: "no-store" });
    if (!profileResponse.ok) return json({ error: "Authorization unavailable" }, 503);
    const profiles = await profileResponse.json();
    if (!Array.isArray(profiles) || !profiles.some(p => p.profile === "NEXUS_ROOT" && p.active === true)) return json({ error: "Forbidden" }, 403);

    const organizationId = new URL(request.url).searchParams.get("organization_id") || "";
    if (!UUID.test(organizationId)) return json({ error: "Valid organization_id required" }, 400);
    const get = async (table, params) => {
      const response = await fetch(`${base}/rest/v1/${table}?${new URLSearchParams(params)}`, { headers: adminHeaders, cache: "no-store" });
      if (!response.ok) throw new Error(`read_failed:${table}:${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error(`invalid_response:${table}`);
      return rows;
    };
    const [clients, walletRows, pendingRows] = await Promise.all([
      get("nexus_clients", { select: "id,status", organization_id: `eq.${organizationId}`, limit: "101" }),
      get("nexus_chatbot_message_wallets", { select: "plan_code,monthly_allowance,cycle_start,cycle_end,included_remaining,prepaid_remaining", organization_id: `eq.${organizationId}`, limit: "2" }),
      get("nexus_chatbot_outbound_operations", { select: "id,status", organization_id: `eq.${organizationId}`, status: "in.(reserved,uncertain)", limit: "101" }),
    ]);
    if (clients.length > 100 || walletRows.length > 1 || pendingRows.length > 100) return json({ error: "Audit scope exceeds safe limit" }, 409);
    const clientIds = clients.map(c => c.id).filter(id => UUID.test(id));
    if (clientIds.length !== clients.length) return json({ error: "Invalid client records" }, 503);
    const contracts = clientIds.length ? await get("nexus_contracts", {
      select: "id,client_id,status,start_date,end_date", client_id: `in.(${clientIds.join(",")})`, limit: "501",
    }) : [];
    if (contracts.length > 500) return json({ error: "Contract audit truncated" }, 409);
    const contractIds = contracts.map(c => c.id);
    if (contractIds.some(id => !UUID.test(id))) return json({ error: "Invalid contract records" }, 503);
    const items = contractIds.length ? await get("nexus_contract_items", {
      select: "contract_id,product_id", contract_id: `in.(${contractIds.join(",")})`, limit: "1001",
    }) : [];
    if (items.length > 1000) return json({ error: "Contract items truncated" }, 409);
    const productIds = [...new Set(items.map(i => i.product_id))];
    if (productIds.some(id => !UUID.test(id))) return json({ error: "Invalid product records" }, 503);
    const products = productIds.length ? await get("nexus_products", {
      select: "id,code,active", id: `in.(${productIds.join(",")})`, limit: "1001",
    }) : [];
    if (products.length !== productIds.length) return json({ error: "Product records incomplete" }, 503);
    const productById = new Map(products.map(p => [p.id, p]));
    const codesByContract = new Map();
    for (const item of items) {
      const p = productById.get(item.product_id);
      if (!p) return json({ error: "Product reference missing" }, 503);
      if (p.active === true && ["CHATBOT_BASIC", "CHATBOT_AI"].includes(p.code)) {
        const set = codesByContract.get(item.contract_id) || new Set();
        set.add(p.code);
        codesByContract.set(item.contract_id, set);
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const clientById = new Map(clients.map(c => [c.id, c]));
    const eligible = contracts.filter(c => {
      const client = clientById.get(c.client_id);
      return client && String(client.status).toLowerCase() === "active" &&
        ["active", "ativo"].includes(String(c.status).toLowerCase()) &&
        c.start_date && c.start_date <= today && (!c.end_date || c.end_date >= today);
    });
    const basic = eligible.filter(c => codesByContract.get(c.id)?.has("CHATBOT_BASIC"));
    const standard = eligible.filter(c => codesByContract.get(c.id)?.has("CHATBOT_AI"));
    const wallet = walletRows[0] || null;
    const walletCycleActive = Boolean(wallet?.cycle_start && wallet?.cycle_end && wallet.cycle_start <= today && today < wallet.cycle_end);
    const blockers = [];
    if (clients.length === 0) blockers.push("client_missing");
    if (standard.length !== 1) blockers.push(standard.length ? "multiple_standard_contracts" : "standard_contract_missing");
    if (basic.length) blockers.push("basic_contract_still_active");
    if (!wallet) blockers.push("wallet_missing");
    else if (!walletCycleActive) blockers.push("wallet_cycle_inactive");
    else if (wallet.plan_code !== "CHATBOT_BASIC" || wallet.monthly_allowance !== 1000) blockers.push("wallet_not_basic");
    if (pendingRows.length) blockers.push("pending_outbound_operations");
    // Readiness is advisory only. Never authorizes a mutation or guarantees financial eligibility.
    return json({
      mode: "read_only", organization_id: organizationId,
      contracts: { active_basic: basic.length, active_standard: standard.length,
        basic_ids: basic.map(c => c.id), standard_ids: standard.map(c => c.id) },
      wallet: wallet ? { exists: true, plan_code: wallet.plan_code, monthly_allowance: wallet.monthly_allowance,
        cycle_start: wallet.cycle_start, cycle_end: wallet.cycle_end,
        included_remaining: wallet.included_remaining, prepaid_remaining: wallet.prepaid_remaining,
        cycle_active: walletCycleActive } : { exists: false },
      pending_outbound_operations: pendingRows.length,
      blockers, preconditions_satisfied: blockers.length === 0,
      financial_proration_checked: false, commercial_transition_checked: false,
      ready_to_execute_upgrade: false, sending_enabled: false,
      database_modified: false, credits_granted: false, meta_called: false,
    });
  } catch (error) {
    console.error("chatbot_upgrade_readiness_failed", error?.message || "unknown");
    return json({ error: "Upgrade audit unavailable" }, 503);
  }
}
