import { NextResponse } from "next/server";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function token(request) { return request.cookies.get("nexus_access_token")?.value || ""; }
function h(t, extra = {}) { return { apikey: KEY, Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...extra }; }
function json(message, status, extra={}) { return NextResponse.json({ message, ...extra }, { status }); }

async function rootContext(t) {
  const r = await fetch(`${URL}/rest/v1/nexus_user_profiles?select=profile,active&limit=1`, { headers: h(t), cache: "no-store" });
  const rows = r.ok ? await r.json() : [];
  const p = Array.isArray(rows) ? rows[0] : null;
  return p?.active && ["NEXUS_ROOT","NEXUS_ADMIN"].includes(p.profile) ? p : null;
}

export async function POST(request) {
  try {
    const t = token(request); if (!(await rootContext(t))) return json("Acesso não autorizado.", 403);
    if (!SERVICE) return json("Configure SUPABASE_SERVICE_ROLE_KEY na Vercel para liberar convites de acesso.", 503, { code: "SERVICE_ROLE_REQUIRED" });
    const body = await request.json();
    const clientId = String(body.clientId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (!clientId || !email.includes("@")) return json("Cliente e e-mail são obrigatórios.", 400);

    const clientResponse = await fetch(`${URL}/rest/v1/nexus_clients?id=eq.${encodeURIComponent(clientId)}&select=id,organization_id,legal_name,trade_name&limit=1`, { headers: h(t), cache: "no-store" });
    const clients = clientResponse.ok ? await clientResponse.json() : [];
    const client = Array.isArray(clients) ? clients[0] : null;
    if (!client) return json("Cliente não encontrado.", 404);

    const unitResponse = await fetch(`${URL}/rest/v1/nexus_organization_units?organization_id=eq.${client.organization_id}&is_main=eq.true&active=eq.true&select=id&limit=1`, { headers: h(t), cache: "no-store" });
    const unitRows = unitResponse.ok ? await unitResponse.json() : [];
    const mainUnit = Array.isArray(unitRows) ? unitRows[0] : null;

    const invite = await fetch(`${URL}/auth/v1/invite?redirect_to=${encodeURIComponent(`${request.nextUrl.origin}/definir-senha`)}`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, data: { full_name: String(body.fullName || "").trim(), organization: client.trade_name || client.legal_name, nexus_invited: true } }),
      cache: "no-store",
    });
    const user = await invite.json();
    if (!invite.ok || !user?.id) return json("Não foi possível enviar o convite ao administrador do cliente.", invite.status, { details: user });

    const provision = await fetch(`${URL}/rest/v1/rpc/nexus_provision_user_profile`, {
      method: "POST",
      headers: h(t),
      body: JSON.stringify({
        p_user_id: user.id,
        p_organization_id: client.organization_id,
        p_profile: "CLIENT_ADMIN",
        p_full_name: String(body.fullName || "").trim() || null,
        p_role_title: String(body.roleTitle || "Responsável pela organização").trim(),
        p_phone: String(body.phone || "").replace(/\D/g, "") || null,
        p_permissions: { subscription: true, users: true, units: true, settings: true },
        p_unit_ids: mainUnit?.id ? [mainUnit.id] : [],
      }),
      cache: "no-store",
    });
    const pdata = provision.status === 204 ? null : await provision.json().catch(() => null);
    if (!provision.ok) return json("Convite enviado, mas o perfil CLIENT_ADMIN não foi concluído.", provision.status, { details: pdata });
    return NextResponse.json({ ok: true, message: "Administrador convidado com sucesso." }, { status: 201 });
  } catch { return json("Falha inesperada ao configurar o acesso do cliente.", 500); }
}
