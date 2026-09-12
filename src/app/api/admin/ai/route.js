import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_SMOKE_MODEL = process.env.GROQ_SMOKE_MODEL || "qwen/qwen3.8-27b";

async function groqFetch(path, options = {}) {
  const startedAt = Date.now();
  try {
    const res = await fetch(`${GROQ_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 1200) }; }
    return { ok: res.ok, status: res.status, latencyMs: Date.now() - startedAt, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      data: { error: { message: error?.message || String(error) } },
    };
  }
}

async function runGroqSmoke() {
  if (!GROQ_API_KEY) {
    return {
      ok: false, stage: "environment", code: "GROQ_API_KEY_MISSING",
      message: "GROQ_API_KEY não está configurada neste deployment.", model: GROQ_SMOKE_MODEL,
    };
  }

  const models = await groqFetch("/models", { method: "GET" });
  if (!models.ok) {
    return {
      ok: false, stage: "models_endpoint", code: "GROQ_MODELS_FAILED",
      message: models.data?.error?.message || "A Groq recusou a consulta ao catálogo de modelos.",
      groqHttpStatus: models.status, latencyMs: models.latencyMs, model: GROQ_SMOKE_MODEL,
      groqError: models.data?.error || models.data || null,
    };
  }

  const availableModels = Array.isArray(models.data?.data) ? models.data.data.map((item) => item?.id).filter(Boolean) : [];
  if (!availableModels.includes(GROQ_SMOKE_MODEL)) {
    return {
      ok: false, stage: "model_resolution", code: "GROQ_MODEL_NOT_AVAILABLE",
      message: `O modelo ${GROQ_SMOKE_MODEL} não foi localizado no catálogo retornado pela Groq para esta conta.`,
      model: GROQ_SMOKE_MODEL, catalogModelCount: availableModels.length,
      nearbyModels: availableModels.filter((id) => /qwen/i.test(id)).slice(0, 20),
      latencyMs: models.latencyMs,
    };
  }

  const completion = await groqFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: GROQ_SMOKE_MODEL,
      messages: [
        { role: "system", content: "Responda apenas JSON válido, sem markdown." },
        { role: "user", content: 'Classifique esta solicitação em FINANCEIRO, SUPORTE, COMERCIAL ou OUTRO: "Preciso da segunda via do boleto deste mês." Responda com as chaves categoria e justificativa.' },
      ],
      temperature: 0,
      max_tokens: 180,
      response_format: { type: "json_object" },
    }),
  });

  if (!completion.ok) {
    return {
      ok: false, stage: "chat_completions", code: "GROQ_COMPLETION_FAILED",
      message: completion.data?.error?.message || "A chamada de Chat Completions da Groq falhou.",
      groqHttpStatus: completion.status, model: GROQ_SMOKE_MODEL,
      catalogModelCount: availableModels.length, modelsLatencyMs: models.latencyMs,
      completionLatencyMs: completion.latencyMs, groqError: completion.data?.error || completion.data || null,
    };
  }

  return {
    ok: true, stage: "completed", code: "GROQ_SMOKE_OK",
    message: "Conexão direta com a Groq concluída com sucesso.", model: GROQ_SMOKE_MODEL,
    modelAvailable: true, catalogModelCount: availableModels.length, modelsLatencyMs: models.latencyMs,
    completionLatencyMs: completion.latencyMs, usage: completion.data?.usage || null,
    output: completion.data?.choices?.[0]?.message?.content ?? null,
  };
}

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

  // Primeiro valida a sessão diretamente no Supabase Auth. Isso evita depender
  // de uma leitura RLS sem filtro na tabela de perfis.
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!authResponse.ok) return null;
  const authUser = await authResponse.json();
  if (!authUser?.id) return null;

  const key = SERVICE_ROLE || SUPABASE_KEY;
  const auth = SERVICE_ROLE || token;
  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/nexus_user_profiles?user_id=eq.${encodeURIComponent(authUser.id)}&select=user_id,organization_id,profile,active&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${auth}` }, cache: "no-store" }
  );
  if (!profileResponse.ok) return null;
  const profile = (await profileResponse.json())?.[0];
  return profile?.active && ["NEXUS_ROOT", "NEXUS_ADMIN"].includes(profile.profile)
    ? { token, userId: profile.user_id, organizationId: profile.organization_id || null, profile: profile.profile }
    : null;
}

const PROVIDER_ENV = {
  google: "GEMINI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  openai: "OPENAI_API_KEY",
  cloudflare: "CLOUDFLARE_API_TOKEN",
  groq: "GROQ_API_KEY",
  mock: null,
};
function providerReadiness(provider) {
  const envName = PROVIDER_ENV[provider.code];
  const configured = provider.code === "mock" ? true : envName ? Boolean(process.env[envName]) : false;
  const cfg = provider.config && typeof provider.config === "object" ? provider.config : {};
  const benchmarkEnabled = cfg.benchmark_enabled !== false && configured;
  const productionEnabled = Boolean(provider.active) && configured && cfg.production_enabled !== false;
  return { configured, credentialEnv: envName, benchmarkEnabled, productionEnabled };
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

  // v0.7.4.1: não atribuir toda falha à migration inicial.
  // O console já pode existir e uma consulta isolada falhar por autenticação,
  // variável de ambiente ou indisponibilidade temporária do Supabase.
  const named = { providers, models, routes, limits, operations, costs };
  const failures = Object.entries(named)
    .filter(([, result]) => !result.ok)
    .map(([resource, result]) => ({ resource, status: result.status, details: result.data }));

  if (failures.length) {
    const first = failures[0];
    const serialized = JSON.stringify(first.details || {});
    const relationMissing = first.status === 404 || /42P01|does not exist|relation .* not found/i.test(serialized);
    const authFailure = first.status === 401 || first.status === 403;
    const message = relationMissing
      ? `Estrutura do PLENIUM AI incompleta: recurso ${first.resource} não encontrado. Verifique as migrations aplicadas; não execute novamente a migration inicial sem confirmar a tabela ausente.`
      : authFailure
        ? `Falha de autenticação/autorização ao carregar ${first.resource}. Verifique a sessão e as credenciais Supabase da Vercel.`
        : `Falha ao carregar ${first.resource} no Console PLENIUM AI. O banco existente não será reinicializado.`;
    return json(message, first.status || 500, { code: "PLENIUM_AI_CONSOLE_LOAD_FAILED", failures });
  }

  const ops = operations.data || [];
  const costRows = costs.data || [];
  const totalCostUsd = costRows.reduce((sum, item) => sum + Number(item.provider_cost_usd || 0), 0);
  const totalRevenueUsd = costRows.reduce((sum, item) => sum + Number(item.internal_price_usd || 0), 0);
  const marginUsd = costRows.reduce((sum, item) => sum + Number(item.margin_usd || 0), 0);
  const success = ops.filter((item) => item.status === "SUCCESS").length;
  const fallbacks = ops.filter((item) => item.fallback_used).length;

  return NextResponse.json({
    providers: (providers.data || []).map((provider) => ({ ...provider, readiness: providerReadiness(provider) })),
    models: (models.data || []).map((model) => ({
      ...model,
      providerReadiness: providerReadiness((providers.data || []).find((p) => p.id === model.provider_id) || { code: model.provider?.code, active: false, config: {} }),
    })),
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

  // Não permita ativar provider sem a credencial exigida no ambiente.
  if (body.entity === "provider" && body.active === true) {
    const current = await rest(`nexus_ai_providers?id=eq.${encodeURIComponent(body.id)}&select=*`, {}, ctx.token);
    const provider = current.data?.[0];
    if (!current.ok || !provider) return json("Provider não encontrado.", 404);
    const readiness = providerReadiness(provider);
    if (!readiness.configured) {
      return json(`Credencial ${readiness.credentialEnv || "do provider"} não configurada.`, 409, { readiness });
    }
  }

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

  let body;
  try { body = await request.json(); } catch { return json("JSON inválido.", 400); }

  // v0.7.5.1: smoke test usa a mesma autenticação ROOT já validada pelo Console.
  // Não exige service role e não altera catálogo, rotas ou consumo produtivo.
  if (body?.action === "groq_smoke") {
    const result = await runGroqSmoke();
    return NextResponse.json(result, { status: 200 });
  }

  if (!SERVICE_ROLE) return json("Configure SUPABASE_SERVICE_ROLE_KEY para editar o catálogo de IA.", 503);

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
