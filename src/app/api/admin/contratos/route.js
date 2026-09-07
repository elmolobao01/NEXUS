import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function json(message, status, extra = {}) { return NextResponse.json({ message, ...extra }, { status }); }
function getToken(request) { return request.cookies.get("nexus_access_token")?.value || request.cookies.get("sb-access-token")?.value || ""; }
function supabaseHeaders(token, extra = {}) { return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra }; }
async function getRootContext(token) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !token) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/nexus_user_profiles?select=user_id,organization_id,profile,active&limit=1`, { headers: supabaseHeaders(token), cache: "no-store" });
  if (!response.ok) return null;
  const rows = await response.json();
  const profile = Array.isArray(rows) ? rows[0] : null;
  return profile?.active && ["PLENIUM_ROOT", "PLENIUM_ADMIN"].includes(profile.profile) ? profile : null;
}

export async function GET(request) {
  try {
    const token = getToken(request);
    if (!(await getRootContext(token))) return json("Acesso não autorizado.", 403);
    const params = new URLSearchParams();
    params.set("select", "id,client_id,number,start_date,end_date,billing_cycle,duration_months,value,gross_value,discount_pct,discount_value,net_value,status,notes,created_at,nexus_clients(legal_name,trade_name),nexus_contract_items(nexus_products(name))");
    params.set("order", "created_at.desc");
    const response = await fetch(`${SUPABASE_URL}/rest/v1/nexus_contracts?${params.toString()}`, { headers: supabaseHeaders(token), cache: "no-store" });
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
    const body = await request.json();
    const productIds = Array.isArray(body.productIds) ? [...new Set(body.productIds.map(String).filter(Boolean))] : [];
    if (!body.clientId || !String(body.number || "").trim() || !body.startDate || !productIds.length) return json("Cliente, número, data inicial e produto são obrigatórios.", 400);
    const durationMonths = Number(body.durationMonths || 0);
    if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 120) return json("Informe um prazo válido.", 400);
    if (body.billingCycle === "annual" && durationMonths % 12 !== 0) return json("Contratos anuais devem usar prazo múltiplo de 12 meses.", 400);
    const payload = {
      p_client_id: String(body.clientId),
      p_number: String(body.number).trim(),
      p_start_date: String(body.startDate),
      p_billing_cycle: body.billingCycle === "annual" ? "annual" : "monthly",
      p_duration_months: durationMonths,
      p_status: String(body.status || "draft"),
      p_product_ids: productIds,
      p_referral_name: String(body.referralName || "").trim() || null,
      p_referral_discount_pct: Number(body.referralDiscountPct || 0),
      p_manual_discount_pct: Number(body.manualDiscountPct || 0),
      p_manual_discount_reason: String(body.manualDiscountReason || "").trim() || null,
      p_notes: String(body.notes || "").trim() || null,
    };
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/nexus_create_contract_v2`, { method: "POST", headers: supabaseHeaders(token), body: JSON.stringify(payload), cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      const duplicate = String(data?.message || "").includes("nexus_contracts_number_key") || String(data?.details || "").includes("number");
      return json(duplicate ? "Já existe um contrato cadastrado com este número." : "Não foi possível cadastrar o contrato.", duplicate ? 409 : response.status, { details: data });
    }
    return NextResponse.json({ ok: true, contract: Array.isArray(data) ? data[0] : data }, { status: 201 });
  } catch { return json("Falha inesperada ao cadastrar contrato.", 500); }
}
