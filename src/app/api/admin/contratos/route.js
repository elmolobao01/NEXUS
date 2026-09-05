import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function json(message, status, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function getToken(request) {
  return (
    request.cookies.get("nexus_access_token")?.value ||
    request.cookies.get("sb-access-token")?.value ||
    ""
  );
}

async function getRootContext(token) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !token) return null;

  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/nexus_user_profiles?select=user_id,organization_id,profile,active&limit=1`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!profileResponse.ok) return null;

  const rows = await profileResponse.json();
  const profile = Array.isArray(rows) ? rows[0] : null;

  if (
    !profile?.active ||
    !["NEXUS_ROOT", "NEXUS_ADMIN"].includes(profile.profile)
  ) {
    return null;
  }

  return profile;
}

function supabaseHeaders(token, extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function GET(request) {
  try {
    const token = getToken(request);
    const root = await getRootContext(token);

    if (!root) {
      return json("Acesso não autorizado.", 403);
    }

    const params = new URLSearchParams();
    params.set(
      "select",
      "id,client_id,number,start_date,end_date,billing_cycle,value,status,notes,created_at,nexus_clients(legal_name,trade_name)"
    );
    params.set("order", "created_at.desc");

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/nexus_contracts?${params.toString()}`,
      {
        headers: supabaseHeaders(token),
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return json("Não foi possível carregar os contratos.", response.status, {
        details: data,
      });
    }

    const contracts = (Array.isArray(data) ? data : []).map((item) => ({
      ...item,
      client_name:
        item.nexus_clients?.trade_name ||
        item.nexus_clients?.legal_name ||
        "",
    }));

    return NextResponse.json({ ok: true, contracts });
  } catch {
    return json("Falha inesperada ao carregar contratos.", 500);
  }
}

export async function POST(request) {
  try {
    const token = getToken(request);
    const root = await getRootContext(token);

    if (!root) {
      return json("Acesso não autorizado.", 403);
    }

    const body = await request.json();

    const payload = {
      client_id: String(body.clientId || "").trim(),
      number: String(body.number || "").trim(),
      start_date: String(body.startDate || "").trim(),
      end_date: String(body.endDate || "").trim() || null,
      billing_cycle:
        String(body.billingCycle || "monthly") === "annual"
          ? "annual"
          : "monthly",
      value: Number(body.value || 0),
      status: String(body.status || "draft").trim(),
      notes: String(body.notes || "").trim() || null,
    };

    if (!payload.client_id || !payload.number || !payload.start_date) {
      return json("Cliente, número e data inicial são obrigatórios.", 400);
    }

    if (!Number.isFinite(payload.value) || payload.value < 0) {
      return json("Informe um valor contratual válido.", 400);
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/nexus_contracts`, {
      method: "POST",
      headers: supabaseHeaders(token, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      const duplicate =
        String(data?.message || "").includes("nexus_contracts_number_key") ||
        String(data?.details || "").includes("number");

      return json(
        duplicate
          ? "Já existe um contrato cadastrado com este número."
          : "Não foi possível cadastrar o contrato.",
        duplicate ? 409 : response.status,
        { details: data }
      );
    }

    const contract = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, contract }, { status: 201 });
  } catch {
    return json("Falha inesperada ao cadastrar contrato.", 500);
  }
}
