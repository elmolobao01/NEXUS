import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(message, status, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function getToken(request) {
  return request.cookies.get("nexus_access_token")?.value || "";
}

function headers(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function requireRoot(request) {
  const token = getToken(request);
  if (!token || !SUPABASE_URL || !SUPABASE_KEY) return null;
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/nexus_user_profiles?select=user_id,profile,active&limit=1`,
    { headers: { ...headers(SUPABASE_KEY), Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!response.ok) return null;
  const profile = (await response.json())?.[0];
  return profile?.active && ["NEXUS_ROOT", "NEXUS_ADMIN"].includes(profile.profile)
    ? { token, userId: profile.user_id }
    : null;
}

async function rest(path, options = {}, token = null) {
  const key = SERVICE_ROLE || SUPABASE_KEY;
  const auth = SERVICE_ROLE || token;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...headers(key, options.headers || {}),
      Authorization: `Bearer ${auth}`,
    },
    cache: "no-store",
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return { ok: response.ok, status: response.status, data };
}

export async function GET(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return json("Acesso ROOT necessário.", 403);

  const [providers, models, routes, limits, operations, costs, organizations] = await Promise.all([
    rest("nexus_ai_providers?select=*&order=priority.asc,name.asc", {}, ctx.token),
    rest("nexus_ai_models?select=*,provider:nexus_ai_providers(code,name)&order=level.asc,name.asc", {}, ctx.token),
    rest("nexus_ai_routes?select=*,model:nexus_ai_models!nexus_ai_routes_model_id_fkey(code,name),fallback:nexus_ai_models!nexus_ai_routes_fallback_model_id_fkey(code,name)&order=level.asc,priority.asc", {}, ctx.token),
    rest("nexus_ai_client_limits?select=*&order=created_at.desc", {}, ctx.token),
    rest("nexus_ai_operations?select=*&order=created_at.desc&limit=250", {}, ctx.token),
    rest("nexus_ai_costs?select=*&order=created_at.desc&limit=250", {}, ctx.token),
    rest("nexus_organizations?select=id,name,legal_name&order=name.asc", {}, ctx.token),
  ]);

  const failed = [providers, models, routes, limits, operations, costs].find((item) => !item.ok);
  if (failed) {
    return json(
      "Não foi possível carregar o Console PLENIUM AI. Execute a migration 20260908_001_plenium_ai_engine.sql.",
      failed.status || 500,
      { details: failed.data }
    );
  }

  const ops = operations.data || [];
  const costRows = costs.data || [];
  const totalCostUsd = costRows.reduce((sum, item) => sum + Number(item.provider_cost_usd || 0), 0);
  const totalRevenueUsd = costRows.reduce((sum, item) => sum + Number(item.internal_price_usd || 0), 0);
  const marginUsd = costRows.reduce((sum, item) => sum + Number(item.margin_usd || 0), 0);
  const success = ops.filter((item) => item.status === "SUCCESS").length;
  const fallbacks = ops.filter((item) => item.fallback_used).length;

  return NextResponse.json({
    providers: providers.data || [],
    models: models.data || [],
    routes: routes.data || [],
    limits: limits.data || [],
    operations: ops,
    costs: costRows,
    organizations: organizations.ok ? organizations.data || [] : [],
    metrics: {
      operations: ops.length,
      successRate: ops.length ? (success / ops.length) * 100 : 0,
      fallbackRate: ops.length ? (fallbacks / ops.length) * 100 : 0,
      totalCostUsd,
      totalRevenueUsd,
      marginUsd,
      marginRate: totalRevenueUsd > 0 ? (marginUsd / totalRevenueUsd) * 100 : 0,
    },
    serviceRoleConfigured: Boolean(SERVICE_ROLE),
  });
}

export async function PATCH(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return json("Acesso ROOT necessário.", 403);
  if (!SERVICE_ROLE) return json("Configure SUPABASE_SERVICE_ROLE_KEY para editar o catálogo de IA.", 503);

  let body;
  try { body = await request.json(); } catch { return json("JSON inválido.", 400); }

  const map = {
    provider: "nexus_ai_providers",
    model: "nexus_ai_models",
    route: "nexus_ai_routes",
    limit: "nexus_ai_client_limits",
  };
  const table = map[body?.entity];
  if (!table || !body?.id) return json("Entidade ou id inválido.", 400);

  const allowed = {
    provider: ["active", "priority", "base_url", "config"],
    model: ["active", "level", "input_cost_per_million", "output_cost_per_million", "capabilities", "config"],
    route: ["active", "priority", "level", "model_id", "fallback_model_id", "min_quality_score", "conditions"],
    limit: ["active", "hard_limit", "monthly_operations", "monthly_input_tokens", "monthly_output_tokens", "monthly_cost_usd"],
  }[body.entity];

  const payload = {};
  for (const key of allowed) if (body[key] !== undefined) payload[key] = body[key];
  payload.updated_at = new Date().toISOString();

  const result = await rest(`${table}?id=eq.${encodeURIComponent(body.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  }, ctx.token);
  if (!result.ok) return json("Falha ao atualizar configuração de IA.", result.status, { details: result.data });
  return NextResponse.json({ ok: true, item: result.data?.[0] || null });
}

export async function POST(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return json("Acesso ROOT necessário.", 403);
  if (!SERVICE_ROLE) return json("Configure SUPABASE_SERVICE_ROLE_KEY para editar o catálogo de IA.", 503);

  let body;
  try { body = await request.json(); } catch { return json("JSON inválido.", 400); }

  if (body?.entity === "route") {
    const payload = {
      operation_type: String(body.operationType || "*").trim() || "*",
      level: Number(body.level ?? 1),
      model_id: body.modelId || null,
      fallback_model_id: body.fallbackModelId || null,
      priority: Number(body.priority ?? 100),
      min_quality_score: Number(body.minQualityScore ?? 0),
      active: body.active !== false,
      conditions: body.conditions && typeof body.conditions === "object" ? body.conditions : {},
    };
    const result = await rest("nexus_ai_routes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([payload]),
    }, ctx.token);
    if (!result.ok) return json("Falha ao criar rota.", result.status, { details: result.data });
    return NextResponse.json({ ok: true, route: result.data?.[0] }, { status: 201 });
  }

  if (body?.entity === "limit") {
    if (!body.organizationId) return json("Selecione o cliente/organização.", 400);
    const payload = {
      organization_id: body.organizationId,
      operation_type: String(body.operationType || "*").trim() || "*",
      monthly_operations: body.monthlyOperations === "" || body.monthlyOperations == null ? null : Number(body.monthlyOperations),
      monthly_cost_usd: body.monthlyCostUsd === "" || body.monthlyCostUsd == null ? null : Number(body.monthlyCostUsd),
      hard_limit: body.hardLimit !== false,
      active: true,
    };
    const result = await rest("nexus_ai_client_limits?on_conflict=organization_id,operation_type", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([payload]),
    }, ctx.token);
    if (!result.ok) return json("Falha ao salvar limite.", result.status, { details: result.data });
    return NextResponse.json({ ok: true, limit: result.data?.[0] }, { status: 201 });
  }

  return json("Entidade não suportada.", 400);
}
