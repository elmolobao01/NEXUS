import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function json(message, status, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function getToken(request) {
  return request.cookies.get("nexus_access_token")?.value || "";
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

    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get("search") || "").trim();
    const segment = String(searchParams.get("segment") || "").trim();
    const status = String(searchParams.get("status") || "").trim();

    const params = new URLSearchParams();
    params.set(
      "select",
      "id,organization_id,legal_name,trade_name,document_type,document_number,email,phone,segment,status,notes,created_at,updated_at"
    );
    params.set("order", "created_at.desc");

    if (segment && segment !== "Todos") {
      params.set("segment", `eq.${segment}`);
    }

    if (status && status !== "Todos") {
      params.set("status", `eq.${status}`);
    }

    if (search) {
      const safeSearch = search.replace(/[%(),]/g, "");
      params.set(
        "or",
        `(legal_name.ilike.*${safeSearch}*,trade_name.ilike.*${safeSearch}*,document_number.ilike.*${safeSearch}*,email.ilike.*${safeSearch}*)`
      );
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/nexus_clients?${params.toString()}`,
      {
        headers: supabaseHeaders(token),
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return json("Não foi possível carregar os clientes.", response.status, {
        details: data,
      });
    }

    return NextResponse.json({ ok: true, clients: data });
  } catch {
    return json("Falha inesperada ao carregar clientes.", 500);
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
      p_legal_name: String(body.legalName || "").trim(),
      p_trade_name: String(body.tradeName || "").trim() || null,
      p_document_type: String(body.documentType || "CNPJ").trim(),
      p_document_number: String(body.documentNumber || "").trim() || null,
      p_email: String(body.email || "").trim().toLowerCase() || null,
      p_phone: String(body.phone || "").trim() || null,
      p_segment: String(body.segment || "").trim(),
      p_status: String(body.status || "implementation").trim(),
      p_notes: String(body.notes || "").trim() || null,
    };

    if (!payload.p_legal_name) {
      return json("Informe a razão social ou nome do cliente.", 400);
    }

    if (!payload.p_segment) {
      return json("Selecione o segmento.", 400);
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/nexus_create_client`,
      {
        method: "POST",
        headers: supabaseHeaders(token),
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const duplicate =
        String(data?.message || "").includes("nexus_clients_document_number_key") ||
        String(data?.details || "").includes("document_number");

      return json(
        duplicate
          ? "Já existe um cliente cadastrado com este documento."
          : "Não foi possível cadastrar o cliente.",
        duplicate ? 409 : response.status,
        { details: data }
      );
    }

    const client = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, client }, { status: 201 });
  } catch {
    return json("Falha inesperada ao cadastrar cliente.", 500);
  }
}

export async function PATCH(request) {
  try {
    const token = getToken(request);
    const root = await getRootContext(token);

    if (!root) {
      return json("Acesso não autorizado.", 403);
    }

    const body = await request.json();
    const clientId = String(body.clientId || "").trim();
    const status = String(body.status || "").trim();

    if (!clientId || !status) {
      return json("Cliente e status são obrigatórios.", 400);
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/nexus_update_client_status`,
      {
        method: "POST",
        headers: supabaseHeaders(token),
        body: JSON.stringify({
          p_client_id: clientId,
          p_status: status,
        }),
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return json("Não foi possível atualizar o cliente.", response.status, {
        details: data,
      });
    }

    const client = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, client });
  } catch {
    return json("Falha inesperada ao atualizar cliente.", 500);
  }
}
