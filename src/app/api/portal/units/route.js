import { NextResponse } from "next/server";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function token(request) { return request.cookies.get("nexus_access_token")?.value || ""; }
function h(accessToken, extra = {}) { return { apikey: KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...extra }; }
function json(message, status, extra = {}) { return NextResponse.json({ message, ...extra }, { status }); }

async function requester(accessToken) {
  const r = await fetch(`${URL}/rest/v1/nexus_user_profiles?select=organization_id,profile,active&limit=1`, { headers: h(accessToken), cache: "no-store" });
  const rows = r.ok ? await r.json() : [];
  return Array.isArray(rows) ? rows[0] : null;
}

export async function GET(request) {
  try {
    const accessToken = token(request); const p = await requester(accessToken);
    if (!p?.active) return json("Acesso não autorizado.", 403);
    const org = request.nextUrl.searchParams.get("organizationId") || p.organization_id;
    const r = await fetch(`${URL}/rest/v1/nexus_organization_units?organization_id=eq.${encodeURIComponent(org)}&select=id,organization_id,name,code,is_main,active,created_at&order=is_main.desc,name.asc`, { headers: h(accessToken), cache: "no-store" });
    const data = await r.json();
    if (!r.ok) return json("Não foi possível carregar as unidades.", r.status, { details: data });
    return NextResponse.json({ ok: true, units: data });
  } catch { return json("Falha inesperada ao carregar unidades.", 500); }
}

export async function POST(request) {
  try {
    const accessToken = token(request); const p = await requester(accessToken);
    if (!p?.active || !["NEXUS_ROOT","NEXUS_ADMIN","CLIENT_ADMIN","MANAGER"].includes(p.profile)) return json("Acesso não autorizado.", 403);
    const body = await request.json();
    const organizationId = body.organizationId || p.organization_id;
    const name = String(body.name || "").trim();
    if (!name) return json("Informe o nome da unidade.", 400);
    const payload = { organization_id: organizationId, name, code: String(body.code || "").trim() || null, is_main: Boolean(body.isMain), active: true };
    const r = await fetch(`${URL}/rest/v1/nexus_organization_units`, { method: "POST", headers: h(accessToken, { Prefer: "return=representation" }), body: JSON.stringify(payload), cache: "no-store" });
    const data = await r.json();
    if (!r.ok) return json("Não foi possível cadastrar a unidade.", r.status, { details: data });
    return NextResponse.json({ ok: true, unit: Array.isArray(data) ? data[0] : data }, { status: 201 });
  } catch { return json("Falha inesperada ao cadastrar unidade.", 500); }
}

export async function PATCH(request) {
  try {
    const accessToken = token(request); const p = await requester(accessToken);
    if (!p?.active || !["NEXUS_ROOT","NEXUS_ADMIN","CLIENT_ADMIN","MANAGER"].includes(p.profile)) return json("Acesso não autorizado.", 403);
    const body = await request.json();
    if (!body.unitId) return json("Unidade obrigatória.", 400);
    const payload = { name: String(body.name || "").trim(), code: String(body.code || "").trim() || null, active: body.active !== false, updated_at: new Date().toISOString() };
    const r = await fetch(`${URL}/rest/v1/nexus_organization_units?id=eq.${encodeURIComponent(body.unitId)}`, { method: "PATCH", headers: h(accessToken, { Prefer: "return=representation" }), body: JSON.stringify(payload), cache: "no-store" });
    const data = await r.json();
    if (!r.ok) return json("Não foi possível atualizar a unidade.", r.status, { details: data });
    return NextResponse.json({ ok: true, unit: Array.isArray(data) ? data[0] : data });
  } catch { return json("Falha inesperada ao atualizar unidade.", 500); }
}
