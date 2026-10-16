import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(message, status, extra = {}) { return NextResponse.json({ message, ...extra }, { status }); }
function getToken(request) { return request.cookies.get("nexus_access_token")?.value || request.cookies.get("sb-access-token")?.value || ""; }
function supabaseHeaders(token, extra = {}) { return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra }; }
async function getRootContext(token) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !token) return null;
  // Verify the caller's token with Supabase Auth, rather than trusting a profile list.
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: supabaseHeaders(token), cache: "no-store",
  });
  if (!authResponse.ok) return null;
  const user = await authResponse.json();
  if (!user?.id) return null;
  const params = new URLSearchParams({
    select: "user_id,organization_id,profile,active",
    user_id: `eq.${user.id}`,
    active: "eq.true",
    limit: "1",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/nexus_user_profiles?${params}`, {
    headers: supabaseHeaders(token), cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = await response.json();
  const profile = Array.isArray(rows) ? rows[0] : null;
  return profile && ["NEXUS_ROOT", "NEXUS_ADMIN"].includes(profile.profile) ? profile : null;
}

export async function GET(request) {
  try {
    const token = getToken(request);
    if (!(await getRootContext(token))) return json("Acesso não autorizado.", 403);
    if (!SERVICE_ROLE_KEY) return json("Configuração do servidor incompleta.", 503);
    const params = new URLSearchParams();
    params.set("select", "id,client_id,number,start_date,end_date,billing_cycle,duration_months,value,gross_value,discount_pct,discount_value,net_value,status,notes,created_at,nexus_clients(legal_name,trade_name),nexus_contract_items(nexus_products(name))");
    params.set("order", "created_at.desc");
    const response = await fetch(`${SUPABASE_URL}/rest/v1/nexus_contracts?${params.toString()}`, { headers: supabaseHeaders(SERVICE_ROLE_KEY), cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return json("Não foi possível carregar os contratos.", response.status, { details: data });
    const contracts = (Array.isArray(data) ? data : []).map((item) => ({
      ...item,
      client_name: item.nexus_clients?.trade_name || item.nexus_clients?.legal_name || "",
      product_names: (item.nexus_contract_items || []).map((contractItem) => contractItem.nexus_products?.name).filter(Boolean),
    }));
    return NextResponse.json({ ok: true, contracts });
  } catch { return json("Falha inesperada ao carregar contratos.", 500); }
}

export async function POST(request) {
  try {
    const token = getToken(request);
    if (!(await getRootContext(token))) return json("Acesso não autorizado.", 403);
    if (!SERVICE_ROLE_KEY) return json("Configure SUPABASE_SERVICE_ROLE_KEY na Vercel para cadastrar contratos.", 503);
    const body = await request.json();
    const productIds = Array.isArray(body.productIds) ? [...new Set(body.productIds.map(String).filter(Boolean))] : [];
    if (!body.clientId || !body.startDate || !productIds.length) return json("Cliente, data inicial e produto são obrigatórios.", 400);
    const durationMonths = Number(body.durationMonths || 0);
    if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 120) return json("Informe um prazo válido.", 400);
    if (body.billingCycle === "annual" && durationMonths % 12 !== 0) return json("Contratos anuais devem usar prazo múltiplo de 12 meses.", 400);
    const primaryProductId = String(body.primaryProductId || productIds[0]);
    if (!productIds.includes(primaryProductId)) return json("Selecione um produto principal válido.", 400);
    const orderedProductIds = [primaryProductId, ...productIds.filter((id) => id !== primaryProductId)];
    const payload = {
      p_client_id: String(body.clientId),
      p_number: "",
      p_start_date: String(body.startDate),
      p_billing_cycle: body.billingCycle === "annual" ? "annual" : "monthly",
      p_duration_months: durationMonths,
      p_status: String(body.status || "draft"),
      p_product_ids: orderedProductIds,
      p_referral_name: String(body.referralName || "").trim() || null,
      p_referral_discount_pct: Number(body.referralDiscountPct || 0),
      p_manual_discount_pct: Number(body.manualDiscountPct || 0),
      p_manual_discount_reason: String(body.manualDiscountReason || "").trim() || null,
      p_notes: String(body.notes || "").trim() || null,
    };
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/nexus_create_contract_v2`, { method: "POST", headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      const duplicate = String(data?.message || "").includes("nexus_contracts_number_key") || String(data?.details || "").includes("number");
      return json(duplicate ? "Já existe um contrato cadastrado com este número." : "Não foi possível cadastrar o contrato.", duplicate ? 409 : response.status, { details: data });
    }
    return NextResponse.json({ ok: true, contract: Array.isArray(data) ? data[0] : data }, { status: 201 });
  } catch { return json("Falha inesperada ao cadastrar contrato.", 500); }
}

// Alterações de estado e renovação são transações auditadas no banco.
export async function PATCH(request) {
  try {
    const token = getToken(request);
    const actor = await getRootContext(token);
    if (!actor) return json("Acesso não autorizado.", 403);
    if (!SERVICE_ROLE_KEY) return json("Configuração do servidor incompleta.", 503);
    const body = await request.json();
    const action = String(body.action || "");
    if (!["suspend", "reactivate", "cancel", "renew", "end"].includes(action)) return json("Operação inválida.", 400);
    if (!/^[0-9a-f-]{36}$/i.test(String(body.contractId || ""))) return json("Contrato inválido.", 400);
    const reason = String(body.reason || "").trim();
    if (reason.length < 10 || reason.length > 2000) return json("Informe uma justificativa com 10 a 2000 caracteres.", 400);
    const payload = {
      p_contract_id: body.contractId,
      p_action: action,
      p_reason: reason,
      p_actor_id: actor.user_id,
      p_start_date: action === "renew" ? body.startDate : null,
      p_duration_months: action === "renew" ? Number(body.durationMonths) : null,
    };
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/nexus_manage_contract_lifecycle`, {
      method: "POST",
      headers: supabaseHeaders(SERVICE_ROLE_KEY),
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) return json("Não foi possível executar a operação contratual.", response.status, { details: data });
    return NextResponse.json({ ok: true, result: data });
  } catch { return json("Falha inesperada na gestão contratual.", 500); }
}
