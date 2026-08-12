import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getToken(request) {
  return request.cookies.get("nexus_access_token")?.value || "";
}

function headers(token, extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function json(message, status, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function getRequester(token) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !token) return null;
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/nexus_user_profiles?select=user_id,organization_id,profile,active&limit=1`,
    { headers: headers(token), cache: "no-store" }
  );
  const rows = response.ok ? await response.json() : [];
  const profile = Array.isArray(rows) ? rows[0] : null;
  return profile?.active ? profile : null;
}

export async function GET(request) {
  try {
    const token = getToken(request);
    const requester = await getRequester(token);
    if (!requester || !["NEXUS_ROOT", "NEXUS_ADMIN", "CLIENT_ADMIN", "MANAGER"].includes(requester.profile)) {
      return json("Acesso não autorizado.", 403);
    }

    const organizationId = request.nextUrl.searchParams.get("organizationId") || requester.organization_id;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/nexus_list_organization_users`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ p_organization_id: organizationId || null }),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) return json("Não foi possível carregar os usuários.", response.status, { details: data });
    return NextResponse.json({ ok: true, users: data });
  } catch {
    return json("Falha inesperada ao carregar usuários.", 500);
  }
}

export async function POST(request) {
  try {
    const token = getToken(request);
    const requester = await getRequester(token);
    if (!requester || !["NEXUS_ROOT", "NEXUS_ADMIN", "CLIENT_ADMIN"].includes(requester.profile)) {
      return json("Acesso não autorizado.", 403);
    }
    if (!SERVICE_ROLE_KEY) {
      return json("O provisionamento de usuários requer SUPABASE_SERVICE_ROLE_KEY configurada somente no servidor da Vercel.", 503, { code: "SERVICE_ROLE_REQUIRED" });
    }

    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const organizationId = String(body.organizationId || requester.organization_id || "").trim();
    const profile = String(body.profile || "OPERATOR").trim();
    if (!email.includes("@") || !organizationId) return json("E-mail e organização são obrigatórios.", 400);

    const redirectTo = `${request.nextUrl.origin}/definir-senha`;
    const inviteResponse = await fetch(`${SUPABASE_URL}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        data: { full_name: String(body.fullName || "").trim(), nexus_invited: true },
      }),
      cache: "no-store",
    });
    const inviteData = await inviteResponse.json();
    if (!inviteResponse.ok || !inviteData?.id) {
      return json("Não foi possível enviar o convite de acesso.", inviteResponse.status, { details: inviteData });
    }

    const provisionResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/nexus_provision_user_profile`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        p_user_id: inviteData.id,
        p_organization_id: organizationId,
        p_profile: profile,
        p_full_name: String(body.fullName || "").trim() || null,
        p_role_title: String(body.roleTitle || "").trim() || null,
        p_phone: String(body.phone || "").replace(/\D/g, "") || null,
        p_permissions: body.permissions && typeof body.permissions === "object" ? body.permissions : {},
        p_unit_ids: Array.isArray(body.unitIds) ? body.unitIds : [],
      }),
      cache: "no-store",
    });
    const provisionData = provisionResponse.status === 204 ? null : await provisionResponse.json().catch(() => null);
    if (!provisionResponse.ok) {
      return json("Convite enviado, mas não foi possível concluir o perfil NEXUS.", provisionResponse.status, { details: provisionData });
    }

    return NextResponse.json({ ok: true, userId: inviteData.id, message: "Convite enviado e perfil NEXUS criado." }, { status: 201 });
  } catch {
    return json("Falha inesperada ao provisionar usuário.", 500);
  }
}

export async function PATCH(request) {
  try {
    const token = getToken(request);
    const requester = await getRequester(token);
    if (!requester || !["NEXUS_ROOT", "NEXUS_ADMIN", "CLIENT_ADMIN"].includes(requester.profile)) {
      return json("Acesso não autorizado.", 403);
    }

    const body = await request.json();
    if (!body.userId) return json("Usuário obrigatório.", 400);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/nexus_update_user_access`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        p_user_id: body.userId,
        p_profile: body.profile || "OPERATOR",
        p_active: body.active !== false,
        p_full_name: body.fullName || null,
        p_role_title: body.roleTitle || null,
        p_phone: String(body.phone || "").replace(/\D/g, "") || null,
        p_permissions: body.permissions && typeof body.permissions === "object" ? body.permissions : {},
        p_unit_ids: Array.isArray(body.unitIds) ? body.unitIds : [],
      }),
      cache: "no-store",
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) return json("Não foi possível atualizar o usuário.", response.status, { details: data });
    return NextResponse.json({ ok: true });
  } catch {
    return json("Falha inesperada ao atualizar usuário.", 500);
  }
}
