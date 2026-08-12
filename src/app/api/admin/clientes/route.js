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

async function syncResponsaveis(token, clientId, responsaveis = []) {
  const del = await fetch(`${SUPABASE_URL}/rest/v1/nexus_client_responsaveis?client_id=eq.${encodeURIComponent(clientId)}`, {
    method: "DELETE", headers: supabaseHeaders(token), cache: "no-store",
  });
  if (!del.ok && del.status !== 404) return { ok: false, response: del };

  if (!responsaveis.length) return { ok: true };
  const rows = responsaveis.map((r) => ({
    client_id: clientId,
    name: String(r.name || "").trim(),
    role: String(r.role || "").trim(),
    types: Array.isArray(r.types) ? r.types : [],
    email: String(r.email || "").trim().toLowerCase() || null,
    phone: String(r.phone || "").replace(/\D/g, "") || null,
    whatsapp: String(r.whatsapp || "").replace(/\D/g, "") || null,
    principal: Boolean(r.principal),
  }));
  const ins = await fetch(`${SUPABASE_URL}/rest/v1/nexus_client_responsaveis`, {
    method: "POST", headers: supabaseHeaders(token), body: JSON.stringify(rows), cache: "no-store",
  });
  return { ok: ins.ok, response: ins };
}

async function syncAccess(token, clientId, organizationId, access = {}) {
  const clean = {
    enabled: Boolean(access.enabled),
    display_name: String(access.displayName || "").trim() || null,
    email: String(access.email || "").trim().toLowerCase() || null,
    profile: String(access.profile || "ADMIN_ORGANIZACAO").trim(),
  };

  const hasConfig = clean.enabled || clean.display_name || clean.email;
  if (!hasConfig) {
    const del = await fetch(`${SUPABASE_URL}/rest/v1/nexus_client_access?client_id=eq.${encodeURIComponent(clientId)}`, {
      method: "DELETE", headers: supabaseHeaders(token), cache: "no-store",
    });
    return { ok: del.ok || del.status === 404, response: del };
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/nexus_client_access?on_conflict=client_id`, {
    method: "POST",
    headers: supabaseHeaders(token, { Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify([{
      client_id: clientId,
      organization_id: organizationId,
      ...clean,
      updated_at: new Date().toISOString(),
    }]),
    cache: "no-store",
  });
  return { ok: resp.ok, response: resp };
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
    const clientId = String(searchParams.get("clientId") || "").trim();

    if (clientId) {
      const [resp, accessResp] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/nexus_client_responsaveis?client_id=eq.${encodeURIComponent(clientId)}&select=id,name,role,types,email,phone,whatsapp,principal,created_at&order=principal.desc,created_at.asc`, { headers: supabaseHeaders(token), cache: "no-store" }),
        fetch(`${SUPABASE_URL}/rest/v1/nexus_client_access?client_id=eq.${encodeURIComponent(clientId)}&select=id,client_id,organization_id,display_name,email,profile,enabled,updated_at&limit=1`, { headers: supabaseHeaders(token), cache: "no-store" }),
      ]);
      const responsaveis = await resp.json();
      if (!resp.ok) return json("Não foi possível carregar os responsáveis.", resp.status, { details: responsaveis });
      const accessRows = accessResp.ok ? await accessResp.json() : [];
      return NextResponse.json({ ok: true, responsaveis, access: Array.isArray(accessRows) ? accessRows[0] || null : null });
    }

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
    const clientId = client?.id;
    const organizationId = client?.organization_id;

    if (clientId) {
      const respSync = await syncResponsaveis(token, clientId, Array.isArray(body.responsaveis) ? body.responsaveis : []);
      if (!respSync.ok) return json("Cliente criado, mas houve falha ao salvar responsáveis.", 500);

      const accessSync = await syncAccess(token, clientId, organizationId, body.access || {});
      if (!accessSync.ok) return json("Cliente criado, mas houve falha ao salvar a configuração de acesso.", 500);
    }

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

export async function PUT(request) {
  try {
    const token = getToken(request);
    const root = await getRootContext(token);
    if (!root) return json("Acesso não autorizado.", 403);

    const body = await request.json();
    const clientId = String(body.clientId || "").trim();
    if (!clientId) return json("Cliente é obrigatório.", 400);

    const clientPayload = {
      legal_name: String(body.legalName || "").trim(),
      trade_name: String(body.tradeName || "").trim() || null,
      document_type: String(body.documentType || "CNPJ").trim(),
      document_number: String(body.documentNumber || "").replace(/\D/g, "") || null,
      email: String(body.email || "").trim().toLowerCase() || null,
      phone: String(body.phone || "").replace(/\D/g, "") || null,
      segment: String(body.segment || "").trim(),
      status: String(body.status || "implementation").trim(),
      notes: String(body.notes || "").trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (!clientPayload.legal_name || !clientPayload.segment) return json("Nome e segmento são obrigatórios.", 400);

    const update = await fetch(`${SUPABASE_URL}/rest/v1/nexus_clients?id=eq.${encodeURIComponent(clientId)}`, {
      method: "PATCH",
      headers: supabaseHeaders(token, { Prefer: "return=representation" }),
      body: JSON.stringify(clientPayload), cache: "no-store",
    });
    const updated = await update.json();
    if (!update.ok) return json("Não foi possível atualizar o cliente.", update.status, { details: updated });

    const responsaveis = Array.isArray(body.responsaveis) ? body.responsaveis : [];
    const respSync = await syncResponsaveis(token, clientId, responsaveis);
    if (!respSync.ok) return json("Cliente atualizado, mas houve falha ao sincronizar responsáveis.", 500);

    const currentClient = Array.isArray(updated) ? updated[0] : updated;
    const accessSync = await syncAccess(token, clientId, currentClient?.organization_id, body.access || {});
    if (!accessSync.ok) return json("Cliente atualizado, mas houve falha ao salvar a configuração de acesso.", 500);

    return NextResponse.json({ ok:true, client:currentClient });
  } catch { return json("Falha inesperada ao atualizar a ficha do cliente.", 500); }
}
