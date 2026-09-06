import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function json(message, status, extra = {}) { return NextResponse.json({ message, ...extra }, { status }); }
function getToken(request) { return request.cookies.get("nexus_access_token")?.value || request.cookies.get("sb-access-token")?.value || ""; }
function headers(token, extra = {}) { return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra }; }

async function root(token) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !token) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/nexus_user_profiles?select=user_id,profile,active&limit=1`, { headers: headers(token), cache: "no-store" });
  if (!response.ok) return null;
  const rows = await response.json();
  const profile = Array.isArray(rows) ? rows[0] : null;
  return profile?.active && ["NEXUS_ROOT", "NEXUS_ADMIN"].includes(profile.profile) ? profile : null;
}

export async function GET(request) {
  const token = getToken(request);
  if (!(await root(token))) return json("Acesso não autorizado.", 403);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/nexus_products?select=id,code,name,category,segment,monthly_price,annual_price,active,created_at&order=name.asc`, { headers: headers(token), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) return json("Não foi possível carregar os produtos.", response.status, { details: data });
  return NextResponse.json({ ok: true, products: data });
}

export async function POST(request) {
  const token = getToken(request);
  if (!(await root(token))) return json("Acesso não autorizado.", 403);
  const body = await request.json();
  const payload = {
    code: String(body.code || "").trim().toUpperCase(),
    name: String(body.name || "").trim(),
    category: String(body.category || "Produto").trim(),
    segment: String(body.segment || "Todos").trim(),
    monthly_price: Number(body.monthlyPrice || 0),
    annual_price: body.annualPrice === "" || body.annualPrice == null ? null : Number(body.annualPrice),
    active: body.active !== false,
  };
  if (!payload.code || !payload.name) return json("Código e nome são obrigatórios.", 400);
  if (!Number.isFinite(payload.monthly_price) || payload.monthly_price < 0) return json("Informe um preço mensal válido.", 400);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/nexus_products`, { method: "POST", headers: headers(token, { Prefer: "return=representation" }), body: JSON.stringify(payload), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) return json("Não foi possível cadastrar o produto.", response.status, { details: data });
  return NextResponse.json({ ok: true, product: Array.isArray(data) ? data[0] : data }, { status: 201 });
}
