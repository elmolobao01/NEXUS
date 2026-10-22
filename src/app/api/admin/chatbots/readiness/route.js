export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

// ROOT-only, strictly read-only. Never returns token material, changes status, or sends messages.
export async function GET(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!base || !pub || !service) return json({ error: "Service unavailable" }, 503);
  if (!token) return json({ error: "Unauthorized" }, 401);
  const userHeaders = { apikey: pub, Authorization: `Bearer ${token}` };
  const adminHeaders = { apikey: service, Authorization: `Bearer ${service}` };
  try {
    const identity = await fetch(`${base}/auth/v1/user`, { headers: userHeaders, cache: "no-store" });
    if (!identity.ok) return json({ error: "Unauthorized" }, 401);
    const user = await identity.json();
    if (!user?.id) return json({ error: "Unauthorized" }, 401);
    const profileRes = await fetch(`${base}/rest/v1/nexus_user_profiles?select=profile,active,organization_id&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true`, { headers: adminHeaders, cache: "no-store" });
    if (!profileRes.ok) return json({ error: "Authorization unavailable" }, 503);
    const profiles = await profileRes.json();
    if (!Array.isArray(profiles) || !profiles.some(p => p.profile === "NEXUS_ROOT" && p.active === true)) return json({ error: "Forbidden" }, 403);
    const org = profiles.find(p => p.profile === "NEXUS_ROOT" && p.active === true)?.organization_id;
    if (!org) return json({ error: "Organization unavailable" }, 503);
    const encodedOrg = encodeURIComponent(org);
    const [connRes, configRes, walletRes, planRes] = await Promise.all([
      fetch(`${base}/rest/v1/nexus_meta_whatsapp_connections?organization_id=eq.${encodedOrg}&select=id,waba_id,phone_number_id,connection_status,credential_reference,connected_at`, { headers: adminHeaders, cache: "no-store" }),
      fetch(`${base}/rest/v1/nexus_chatbot_configs?organization_id=eq.${encodedOrg}&select=active&limit=1`, { headers: adminHeaders, cache: "no-store" }),
      fetch(`${base}/rest/v1/nexus_chatbot_message_wallets?organization_id=eq.${encodedOrg}&select=plan_code,cycle_start,cycle_end,included_remaining,prepaid_remaining&limit=1`, { headers: adminHeaders, cache: "no-store" }),
      fetch(`${base}/rest/v1/rpc/nexus_chatbot_entitlement`, { method: "POST", headers: { ...adminHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ p_organization_id: org }), cache: "no-store" }),
    ]);
    if (![connRes, configRes, walletRes, planRes].every(r => r.ok)) return json({ error: "Readiness lookup unavailable" }, 503);
    const [connections, configs, wallets, plan] = await Promise.all([connRes.json(), configRes.json(), walletRes.json(), planRes.json()]);
    if (!Array.isArray(connections) || !Array.isArray(configs) || !Array.isArray(wallets)) return json({ error: "Unexpected database response" }, 503);
    const wallet = wallets[0] || null;
    const today = new Date().toISOString().slice(0, 10);
    const validPlan = ["CHATBOT_BASIC", "CHATBOT_AI"].includes(plan);
    const walletValid = Boolean(wallet && validPlan && wallet.plan_code === plan && wallet.cycle_start <= today && today < wallet.cycle_end && (wallet.included_remaining > 0 || wallet.prepaid_remaining > 0));
    return json({
      mode: "read_only", organization_id: org, sending_enabled: false, database_modified: false,
      entitlement_plan: validPlan ? plan : "NONE", chatbot_config_active: configs[0]?.active === true,
      wallet: { exists: Boolean(wallet), plan_matches: Boolean(wallet && wallet.plan_code === plan), cycle_current: Boolean(wallet && wallet.cycle_start <= today && today < wallet.cycle_end), credits_available: Boolean(wallet && (wallet.included_remaining > 0 || wallet.prepaid_remaining > 0)), eligible: walletValid },
      connections: connections.map(c => ({ id: c.id, waba_id: c.waba_id, phone_number_id: c.phone_number_id, status: c.connection_status, credential_linked: Boolean(c.credential_reference), connected_at: c.connected_at })),
      ready_for_automated_processing: false,
      next_blockers: [
        ...(!connections.some(c => c.connection_status === "active" && c.credential_reference) ? ["connection_not_active"] : []),
        ...(!validPlan ? ["contract_inactive"] : []),
        ...(configs[0]?.active !== true ? ["chatbot_inactive"] : []),
        ...(!walletValid ? ["wallet_unavailable"] : []),
        "outbound_processor_not_enabled"
      ]
    });
  } catch {
    return json({ error: "Readiness unavailable" }, 503);
  }
}
