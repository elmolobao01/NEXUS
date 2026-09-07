import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function json(message, status, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

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

async function requireRoot(request) {
  const token = getToken(request);
  if (!token || !SUPABASE_URL || !SUPABASE_KEY) return null;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/nexus_user_profiles?select=user_id,profile,active&limit=1`,
    { headers: headers(token), cache: "no-store" }
  );

  if (!response.ok) return null;
  const rows = await response.json();
  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile?.active || !["NEXUS_ROOT", "NEXUS_ADMIN"].includes(profile.profile)) return null;
  return { token, userId: profile.user_id };
}

async function rest(token, path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: headers(token, options.headers || {}),
    cache: "no-store",
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return { ok: response.ok, status: response.status, data };
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function GET(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return json("Acesso ROOT necessário.", 403);

  const [services, plans, accounts, consumption] = await Promise.all([
    rest(ctx.token, "nexus_infra_services?select=*&order=provider.asc,name.asc"),
    rest(ctx.token, "nexus_infra_plans?select=*&order=starts_on.desc,created_at.desc"),
    rest(ctx.token, "nexus_infra_accounts_payable?select=*&order=due_on.asc,created_at.desc"),
    rest(ctx.token, "nexus_infra_consumption?select=*&order=measured_at.desc&limit=1000"),
  ]);

  const failed = [services, plans, accounts, consumption].find((item) => !item.ok);
  if (failed) {
    return json(
      "Não foi possível carregar Infraestrutura. Confirme a execução da migration 20260907_001_infraestrutura_assinaturas.sql.",
      failed.status || 500,
      { details: failed.data }
    );
  }

  return NextResponse.json({
    services: services.data || [],
    plans: plans.data || [],
    accounts: accounts.data || [],
    consumption: consumption.data || [],
  });
}

export async function POST(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return json("Acesso ROOT necessário.", 403);

  let body;
  try { body = await request.json(); } catch { return json("JSON inválido.", 400); }
  const entity = body?.entity;

  if (entity === "service") {
    if (!cleanText(body.name) || !cleanText(body.provider)) return json("Informe serviço e fornecedor.", 400);
    const payload = {
      name: cleanText(body.name),
      provider: cleanText(body.provider),
      category: cleanText(body.category) || "OUTRO",
      product_code: cleanText(body.productCode),
      resource_identifier: cleanText(body.resourceIdentifier),
      management_url: cleanText(body.managementUrl),
      status: body.status || "ACTIVE",
      notes: cleanText(body.notes),
      created_by: ctx.userId,
    };
    const result = await rest(ctx.token, "nexus_infra_services", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([payload]),
    });
    if (!result.ok) return json("Falha ao cadastrar serviço.", result.status, { details: result.data });
    return NextResponse.json({ service: result.data?.[0] }, { status: 201 });
  }

  if (entity === "plan") {
    if (!body.serviceId || !cleanText(body.planName)) return json("Informe o serviço e o nome do plano.", 400);
    const payload = {
      service_id: body.serviceId,
      plan_name: cleanText(body.planName),
      price: numberOrNull(body.price) ?? 0,
      currency: cleanText(body.currency) || "BRL",
      billing_cycle: body.billingCycle || "MONTHLY",
      starts_on: body.startsOn || new Date().toISOString().slice(0, 10),
      ends_on: body.endsOn || null,
      next_renewal_on: body.nextRenewalOn || null,
      auto_renew: Boolean(body.autoRenew),
      consumption_limits: body.consumptionLimits && typeof body.consumptionLimits === "object" ? body.consumptionLimits : {},
      is_active: body.isActive !== false,
      notes: cleanText(body.notes),
      created_by: ctx.userId,
    };
    const result = await rest(ctx.token, "nexus_infra_plans", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([payload]),
    });
    if (!result.ok) return json("Falha ao cadastrar plano.", result.status, { details: result.data });
    return NextResponse.json({ plan: result.data?.[0] }, { status: 201 });
  }

  if (entity === "account") {
    if (!cleanText(body.description) || !body.dueOn) return json("Informe descrição e vencimento.", 400);
    const payload = {
      service_id: body.serviceId || null,
      plan_id: body.planId || null,
      description: cleanText(body.description),
      category: cleanText(body.category) || "INFRAESTRUTURA",
      product_code: cleanText(body.productCode),
      competence_on: body.competenceOn || null,
      due_on: body.dueOn,
      expected_amount: numberOrNull(body.expectedAmount) ?? 0,
      recurrence: body.recurrence || "NONE",
      source: "MANUAL",
      status: "OPEN",
      payment_method: cleanText(body.paymentMethod),
      notes: cleanText(body.notes),
      created_by: ctx.userId,
    };
    const result = await rest(ctx.token, "nexus_infra_accounts_payable", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([payload]),
    });
    if (!result.ok) return json("Falha ao lançar conta.", result.status, { details: result.data });
    return NextResponse.json({ account: result.data?.[0] }, { status: 201 });
  }

  if (entity === "consumption") {
    if (!body.serviceId || !cleanText(body.metricKey) || !cleanText(body.metricLabel)) return json("Informe serviço e métrica.", 400);
    const payload = {
      service_id: body.serviceId,
      metric_key: cleanText(body.metricKey),
      metric_label: cleanText(body.metricLabel),
      unit: cleanText(body.unit) || "un",
      used_value: numberOrNull(body.usedValue) ?? 0,
      limit_value: numberOrNull(body.limitValue),
      estimated_cost: numberOrNull(body.estimatedCost),
      source: body.source === "API" || body.source === "WEBHOOK" ? body.source : "MANUAL",
      measured_at: body.measuredAt || new Date().toISOString(),
      created_by: ctx.userId,
    };
    const result = await rest(ctx.token, "nexus_infra_consumption", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([payload]),
    });
    if (!result.ok) return json("Falha ao registrar consumo.", result.status, { details: result.data });
    return NextResponse.json({ consumption: result.data?.[0] }, { status: 201 });
  }

  if (entity === "generate-payables") {
    const until = body.until || null;
    const result = await rest(ctx.token, "rpc/nexus_infra_generate_payables", {
      method: "POST",
      body: JSON.stringify({ p_until: until }),
    });
    if (!result.ok) return json("Falha ao gerar cobranças.", result.status, { details: result.data });
    return NextResponse.json({ generated: Number(result.data || 0) });
  }

  return json("Entidade não suportada.", 400);
}

export async function PATCH(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return json("Acesso ROOT necessário.", 403);

  let body;
  try { body = await request.json(); } catch { return json("JSON inválido.", 400); }

  if (body?.entity === "account" && body.id && body.action === "pay") {
    const paidAmount = numberOrNull(body.paidAmount);
    const payload = {
      status: "PAID",
      paid_amount: paidAmount,
      paid_on: body.paidOn || new Date().toISOString().slice(0, 10),
      payment_method: cleanText(body.paymentMethod),
    };
    const result = await rest(ctx.token, `nexus_infra_accounts_payable?id=eq.${encodeURIComponent(body.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    if (!result.ok) return json("Falha ao registrar pagamento.", result.status, { details: result.data });
    return NextResponse.json({ account: result.data?.[0] });
  }

  if (body?.entity === "service" && body.id) {
    const payload = {};
    if (body.status) payload.status = body.status;
    if (body.notes !== undefined) payload.notes = cleanText(body.notes);
    const result = await rest(ctx.token, `nexus_infra_services?id=eq.${encodeURIComponent(body.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    if (!result.ok) return json("Falha ao atualizar serviço.", result.status, { details: result.data });
    return NextResponse.json({ service: result.data?.[0] });
  }

  return json("Atualização não suportada.", 400);
}
