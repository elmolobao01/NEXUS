import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROFILE_MAP = {
  ADMIN_ORGANIZACAO: "CLIENT_ADMIN",
  GESTOR: "MANAGER",
  OPERACIONAL: "OPERATOR",
  CONSULTA: "VIEWER",
};

function json(message, status, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function getToken(request) {
  return request.cookies.get("nexus_access_token")?.value || "";
}

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function supabaseHeaders(token, extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function serviceHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
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

async function readClientById(token, clientId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/nexus_clients?id=eq.${encodeURIComponent(clientId)}&select=id,organization_id,legal_name,trade_name,document_type,document_number,email,phone,segment,status,notes,created_at,updated_at&limit=1`,
    { headers: supabaseHeaders(token), cache: "no-store" }
  );
  const rows = await response.json();
  if (!response.ok) return { ok: false, status: response.status, data: rows };
  return { ok: true, data: Array.isArray(rows) ? rows[0] || null : null };
}

async function syncResponsaveis(token, clientId, responsaveis = []) {
  const principalCount = responsaveis.filter((item) => Boolean(item.principal)).length;
  if (principalCount > 1) {
    return { ok: false, status: 400, message: "Defina somente um responsável principal." };
  }

  const invalid = responsaveis.find(
    (item) =>
      !String(item.name || "").trim() ||
      !String(item.role || "").trim() ||
      !Array.isArray(item.types) ||
      item.types.length === 0 ||
      !normalizeEmail(item.email)
  );

  if (invalid) {
    return {
      ok: false,
      status: 400,
      message: "Complete os dados obrigatórios de todos os responsáveis.",
    };
  }

  const del = await fetch(
    `${SUPABASE_URL}/rest/v1/nexus_client_responsaveis?client_id=eq.${encodeURIComponent(clientId)}`,
    {
      method: "DELETE",
      headers: supabaseHeaders(token),
      cache: "no-store",
    }
  );

  if (!del.ok && del.status !== 404) {
    return { ok: false, status: del.status, message: "Falha ao limpar responsáveis anteriores." };
  }

  if (!responsaveis.length) return { ok: true };

  const rows = responsaveis.map((r) => ({
    client_id: clientId,
    name: String(r.name || "").trim(),
    role: String(r.role || "").trim(),
    types: Array.isArray(r.types) ? r.types : [],
    email: normalizeEmail(r.email) || null,
    phone: onlyDigits(r.phone) || null,
    whatsapp: onlyDigits(r.whatsapp) || null,
    principal: Boolean(r.principal),
  }));

  const ins = await fetch(`${SUPABASE_URL}/rest/v1/nexus_client_responsaveis`, {
    method: "POST",
    headers: supabaseHeaders(token),
    body: JSON.stringify(rows),
    cache: "no-store",
  });

  if (!ins.ok) {
    return { ok: false, status: ins.status, message: "Falha ao salvar responsáveis." };
  }

  return { ok: true };
}

async function readAccess(token, clientId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/nexus_client_access?client_id=eq.${encodeURIComponent(clientId)}&select=id,client_id,organization_id,display_name,email,profile,enabled,auth_user_id,provision_status,invited_at,last_provisioned_at,last_error,updated_at&limit=1`,
    { headers: supabaseHeaders(token), cache: "no-store" }
  );

  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function saveAccessConfig(token, clientId, organizationId, access = {}, extra = {}) {
  const clean = {
    enabled: Boolean(access.enabled),
    display_name: String(access.displayName || "").trim() || null,
    email: normalizeEmail(access.email) || null,
    profile: String(access.profile || "ADMIN_ORGANIZACAO").trim(),
  };

  const payload = {
    client_id: clientId,
    organization_id: organizationId,
    ...clean,
    ...extra,
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/nexus_client_access?on_conflict=client_id`,
    {
      method: "POST",
      headers: supabaseHeaders(token, {
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify([payload]),
      cache: "no-store",
    }
  );

  const data = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    data: Array.isArray(data) ? data[0] || null : data,
  };
}

async function insertAudit(token, clientId, action, details = {}) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/nexus_log_client_event`,
      {
        method: "POST",
        headers: supabaseHeaders(token),
        body: JSON.stringify({
          p_client_id: clientId,
          p_action: action,
          p_details: details || {},
        }),
        cache: "no-store",
      }
    );

    return { ok: response.ok, status: response.status };
  } catch {
    // Auditoria não pode interromper a operação principal.
    return { ok: false, status: 500 };
  }
}

async function findAuthUserByEmail(token, email) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/nexus_find_auth_user_by_email`,
    {
      method: "POST",
      headers: supabaseHeaders(token),
      body: JSON.stringify({ p_email: email }),
      cache: "no-store",
    }
  );

  if (!response.ok) return null;
  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row?.user_id ? row : null;
}

async function getProfileByUserId(userId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/nexus_user_profiles?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,organization_id,profile,active&limit=1`,
    {
      headers: serviceHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function upsertUserProfile(userId, organizationId, accessProfile, active) {
  const profile = PROFILE_MAP[accessProfile] || "CLIENT_ADMIN";
  const existing = await getProfileByUserId(userId);

  if (
    existing?.organization_id &&
    existing.organization_id !== organizationId &&
    existing.active
  ) {
    return {
      ok: false,
      status: 409,
      message: "Este usuário já está vinculado a outra organização ativa.",
    };
  }

  const payload = {
    user_id: userId,
    organization_id: organizationId,
    profile,
    active: Boolean(active),
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/nexus_user_profiles?on_conflict=user_id`,
    {
      method: "POST",
      headers: serviceHeaders({
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify([payload]),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    return {
      ok: false,
      status: response.status,
      message: "Não foi possível vincular o perfil do usuário à organização.",
      details,
    };
  }

  return { ok: true };
}

async function updateAuthUser(userId, attributes) {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PUT",
      headers: serviceHeaders(),
      body: JSON.stringify(attributes),
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function inviteAuthUser(email, displayName, organizationId, accessProfile, redirectTo) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      email,
      data: {
        name: displayName,
        organization_id: organizationId,
        nexus_profile: PROFILE_MAP[accessProfile] || "CLIENT_ADMIN",
      },
      redirect_to: redirectTo,
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function provisionAccess(request, token, client, access = {}) {
  const enabled = Boolean(access.enabled);
  const displayName = String(access.displayName || "").trim();
  const email = normalizeEmail(access.email);
  const profile = String(access.profile || "ADMIN_ORGANIZACAO").trim();

  if (!PROFILE_MAP[profile]) {
    return { ok: false, status: 400, message: "Perfil de acesso inválido." };
  }

  const currentAccess = await readAccess(token, client.id);

  if (!enabled) {
    if (currentAccess?.auth_user_id) {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        return {
          ok: false,
          status: 503,
          message: "A chave administrativa do Supabase não está configurada no servidor.",
          code: "NEXUS_AUTH_ADMIN_NOT_CONFIGURED",
        };
      }

      const profileResult = await upsertUserProfile(
        currentAccess.auth_user_id,
        client.organization_id,
        profile,
        false
      );
      if (!profileResult.ok) return profileResult;
    }

    const saved = await saveAccessConfig(token, client.id, client.organization_id, {
      enabled: false,
      displayName,
      email,
      profile,
    }, {
      provision_status: currentAccess?.auth_user_id ? "SUSPENDED" : "NOT_PROVISIONED",
      last_error: null,
    });

    if (!saved.ok) {
      return {
        ok: false,
        status: saved.status,
        message: "Não foi possível salvar a configuração de acesso.",
      };
    }

    await insertAudit(token, client.id, "ACCESS_SUSPENDED", {
      email: email || currentAccess?.email || null,
      profile,
    });

    return { ok: true, access: saved.data, provisioned: false };
  }

  if (!displayName || !email) {
    return {
      ok: false,
      status: 400,
      message: "Para liberar o acesso, informe o nome e o e-mail do usuário principal.",
    };
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      status: 503,
      message: "Configure SUPABASE_SERVICE_ROLE_KEY na Vercel para liberar usuários do Portal do Cliente.",
      code: "NEXUS_AUTH_ADMIN_NOT_CONFIGURED",
    };
  }

  let userId = currentAccess?.auth_user_id || null;
  let invitedNow = false;

  if (userId && currentAccess?.email && normalizeEmail(currentAccess.email) !== email) {
    const updateResult = await updateAuthUser(userId, {
      email,
      user_metadata: {
        name: displayName,
        organization_id: client.organization_id,
        nexus_profile: PROFILE_MAP[profile] || "CLIENT_ADMIN",
      },
    });

    if (!updateResult.ok) {
      await saveAccessConfig(token, client.id, client.organization_id, {
        enabled: true,
        displayName,
        email,
        profile,
      }, {
        auth_user_id: userId,
        provision_status: "ERROR",
        last_error: updateResult.data?.msg || updateResult.data?.message || "Falha ao atualizar e-mail no Auth.",
      });

      return {
        ok: false,
        status: updateResult.status,
        message: "Não foi possível atualizar o usuário no Supabase Auth.",
      };
    }
  }

  if (!userId) {
    const existing = await findAuthUserByEmail(token, email);
    userId = existing?.user_id || null;

    if (!userId) {
      const redirectTo = new URL("/login", request.nextUrl.origin).toString();
      const invite = await inviteAuthUser(
        email,
        displayName,
        client.organization_id,
        profile,
        redirectTo
      );

      if (!invite.ok) {
        const existingAfterFailure = await findAuthUserByEmail(token, email);
        if (existingAfterFailure?.user_id) {
          userId = existingAfterFailure.user_id;
        } else {
          const authMessage =
            invite.data?.msg ||
            invite.data?.message ||
            invite.data?.error_description ||
            "Falha ao enviar convite.";

          await saveAccessConfig(token, client.id, client.organization_id, {
            enabled: true,
            displayName,
            email,
            profile,
          }, {
            provision_status: "ERROR",
            last_error: authMessage,
          });

          return {
            ok: false,
            status: invite.status,
            message: `Não foi possível provisionar o acesso: ${authMessage}`,
          };
        }
      } else {
        userId = invite.data?.id || invite.data?.user?.id || null;
        invitedNow = true;
      }
    }
  }

  if (!userId) {
    return {
      ok: false,
      status: 500,
      message: "O Supabase Auth não retornou o identificador do usuário.",
    };
  }

  const profileResult = await upsertUserProfile(
    userId,
    client.organization_id,
    profile,
    true
  );

  if (!profileResult.ok) return profileResult;

  if (!invitedNow) {
    const updateResult = await updateAuthUser(userId, {
      user_metadata: {
        name: displayName,
        organization_id: client.organization_id,
        nexus_profile: PROFILE_MAP[profile] || "CLIENT_ADMIN",
      },
      ban_duration: "none",
    });

    if (!updateResult.ok) {
      return {
        ok: false,
        status: updateResult.status,
        message: "O vínculo foi criado, mas não foi possível atualizar os metadados do usuário no Auth.",
      };
    }
  }

  const now = new Date().toISOString();
  const saved = await saveAccessConfig(token, client.id, client.organization_id, {
    enabled: true,
    displayName,
    email,
    profile,
  }, {
    auth_user_id: userId,
    provision_status: invitedNow ? "INVITED" : "ACTIVE",
    invited_at: invitedNow ? now : currentAccess?.invited_at || null,
    last_provisioned_at: now,
    last_error: null,
  });

  if (!saved.ok) {
    return {
      ok: false,
      status: saved.status,
      message: "Usuário provisionado, mas houve falha ao registrar a configuração de acesso.",
    };
  }

  await insertAudit(token, client.id, invitedNow ? "ACCESS_INVITED" : "ACCESS_ENABLED", {
    email,
    profile,
    auth_user_id: userId,
  });

  return {
    ok: true,
    access: saved.data,
    provisioned: true,
    invited: invitedNow,
  };
}

export async function GET(request) {
  try {
    const token = getToken(request);
    const root = await getRootContext(token);

    if (!root) return json("Acesso não autorizado.", 403);

    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get("search") || "").trim();
    const segment = String(searchParams.get("segment") || "").trim();
    const status = String(searchParams.get("status") || "").trim();
    const clientId = String(searchParams.get("clientId") || "").trim();

    if (clientId) {
      const [resp, accessResp, auditResp] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/nexus_client_responsaveis?client_id=eq.${encodeURIComponent(clientId)}&select=id,name,role,types,email,phone,whatsapp,principal,created_at&order=principal.desc,created_at.asc`,
          { headers: supabaseHeaders(token), cache: "no-store" }
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/nexus_client_access?client_id=eq.${encodeURIComponent(clientId)}&select=id,client_id,organization_id,display_name,email,profile,enabled,auth_user_id,provision_status,invited_at,last_provisioned_at,last_error,updated_at&limit=1`,
          { headers: supabaseHeaders(token), cache: "no-store" }
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/rpc/nexus_get_client_history`,
          {
            method: "POST",
            headers: supabaseHeaders(token),
            body: JSON.stringify({
              p_client_id: clientId,
              p_limit: 100,
            }),
            cache: "no-store",
          }
        ),
      ]);

      const responsaveis = await resp.json();
      if (!resp.ok) {
        return json("Não foi possível carregar os responsáveis.", resp.status, {
          details: responsaveis,
        });
      }

      const accessRows = accessResp.ok ? await accessResp.json() : [];
      const auditRows = auditResp.ok ? await auditResp.json() : [];

      return NextResponse.json({
        ok: true,
        responsaveis,
        access: Array.isArray(accessRows) ? accessRows[0] || null : null,
        audit: Array.isArray(auditRows) ? auditRows : [],
      });
    }

    const params = new URLSearchParams();
    params.set(
      "select",
      "id,organization_id,legal_name,trade_name,document_type,document_number,email,phone,segment,status,notes,created_at,updated_at"
    );
    params.set("order", "created_at.desc");

    if (segment && segment !== "Todos") params.set("segment", `eq.${segment}`);
    if (status && status !== "Todos") params.set("status", `eq.${status}`);

    if (search) {
      const safeSearch = search.replace(/[%(),]/g, "");
      params.set(
        "or",
        `(legal_name.ilike.*${safeSearch}*,trade_name.ilike.*${safeSearch}*,document_number.ilike.*${safeSearch}*,email.ilike.*${safeSearch}*)`
      );
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/nexus_clients?${params.toString()}`,
      { headers: supabaseHeaders(token), cache: "no-store" }
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
    if (!root) return json("Acesso não autorizado.", 403);

    const body = await request.json();
    const access = body.access || {};

    if (access.enabled && !SUPABASE_SERVICE_ROLE_KEY) {
      return json(
        "Configure SUPABASE_SERVICE_ROLE_KEY na Vercel antes de liberar o Portal do Cliente.",
        503,
        { code: "NEXUS_AUTH_ADMIN_NOT_CONFIGURED" }
      );
    }

    const payload = {
      p_legal_name: String(body.legalName || "").trim(),
      p_trade_name: String(body.tradeName || "").trim() || null,
      p_document_type: String(body.documentType || "CNPJ").trim(),
      p_document_number: onlyDigits(body.documentNumber) || null,
      p_email: normalizeEmail(body.email) || null,
      p_phone: onlyDigits(body.phone) || null,
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

    const respSync = await syncResponsaveis(
      token,
      client.id,
      Array.isArray(body.responsaveis) ? body.responsaveis : []
    );

    if (!respSync.ok) {
      return json(respSync.message, respSync.status || 500);
    }

    const accessResult = await provisionAccess(request, token, client, access);
    if (!accessResult.ok) {
      return json(accessResult.message, accessResult.status || 500, {
        code: accessResult.code,
      });
    }

    await insertAudit(token, client.id, "CLIENT_CREATED", {
      organization_id: client.organization_id,
    });

    return NextResponse.json(
      {
        ok: true,
        client,
        access: accessResult.access || null,
        accessProvision: {
          provisioned: Boolean(accessResult.provisioned),
          invited: Boolean(accessResult.invited),
        },
      },
      { status: 201 }
    );
  } catch {
    return json("Falha inesperada ao cadastrar cliente.", 500);
  }
}

export async function PATCH(request) {
  try {
    const token = getToken(request);
    const root = await getRootContext(token);
    if (!root) return json("Acesso não autorizado.", 403);

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

    await insertAudit(token, clientId, "CLIENT_STATUS_CHANGED", { status });

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

    if (body.access?.enabled && !SUPABASE_SERVICE_ROLE_KEY) {
      return json(
        "Configure SUPABASE_SERVICE_ROLE_KEY na Vercel antes de liberar o Portal do Cliente.",
        503,
        { code: "NEXUS_AUTH_ADMIN_NOT_CONFIGURED" }
      );
    }

    const before = await readClientById(token, clientId);
    if (!before.ok || !before.data) {
      return json("Cliente não encontrado.", before.status || 404);
    }

    const clientPayload = {
      legal_name: String(body.legalName || "").trim(),
      trade_name: String(body.tradeName || "").trim() || null,
      document_type: String(body.documentType || "CNPJ").trim(),
      document_number: onlyDigits(body.documentNumber) || null,
      email: normalizeEmail(body.email) || null,
      phone: onlyDigits(body.phone) || null,
      segment: String(body.segment || "").trim(),
      status: String(body.status || "implementation").trim(),
      notes: String(body.notes || "").trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (!clientPayload.legal_name || !clientPayload.segment) {
      return json("Nome e segmento são obrigatórios.", 400);
    }

    const update = await fetch(
      `${SUPABASE_URL}/rest/v1/nexus_clients?id=eq.${encodeURIComponent(clientId)}`,
      {
        method: "PATCH",
        headers: supabaseHeaders(token, { Prefer: "return=representation" }),
        body: JSON.stringify(clientPayload),
        cache: "no-store",
      }
    );

    const updated = await update.json();

    if (!update.ok) {
      const duplicate =
        String(updated?.message || "").includes("nexus_clients_document_number_key") ||
        String(updated?.details || "").includes("document_number");

      return json(
        duplicate
          ? "Já existe outro cliente cadastrado com este documento."
          : "Não foi possível atualizar o cliente.",
        duplicate ? 409 : update.status,
        { details: updated }
      );
    }

    const currentClient = Array.isArray(updated) ? updated[0] : updated;

    const respSync = await syncResponsaveis(
      token,
      clientId,
      Array.isArray(body.responsaveis) ? body.responsaveis : []
    );

    if (!respSync.ok) {
      return json(respSync.message, respSync.status || 500);
    }

    const accessResult = await provisionAccess(
      request,
      token,
      currentClient,
      body.access || {}
    );

    if (!accessResult.ok) {
      return json(accessResult.message, accessResult.status || 500, {
        code: accessResult.code,
      });
    }

    await insertAudit(token, clientId, "CLIENT_UPDATED", {
      changed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      client: currentClient,
      access: accessResult.access || null,
      accessProvision: {
        provisioned: Boolean(accessResult.provisioned),
        invited: Boolean(accessResult.invited),
      },
    });
  } catch {
    return json("Falha inesperada ao atualizar a ficha do cliente.", 500);
  }
}
