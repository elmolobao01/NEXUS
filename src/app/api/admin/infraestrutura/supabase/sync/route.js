import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const MANAGEMENT_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN;

function reply(message, status, extra = {}) { return NextResponse.json({ message, ...extra }, { status }); }
function tokenFrom(request) { return request.cookies.get("nexus_access_token")?.value || ""; }
function sbHeaders(token, extra = {}) { return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra }; }

async function rest(token, path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: sbHeaders(token, options.headers || {}), cache: "no-store" });
  let data = null; try { data = await response.json(); } catch { data = null; }
  return { ok: response.ok, status: response.status, data };
}

async function requireRoot(request) {
  const token = tokenFrom(request);
  if (!token || !SUPABASE_URL || !SUPABASE_KEY) return null;
  const r = await rest(token, "nexus_user_profiles?select=user_id,profile,active&limit=1");
  const p = Array.isArray(r.data) ? r.data[0] : null;
  return r.ok && p?.active && ["NEXUS_ROOT", "NEXUS_ADMIN"].includes(p.profile) ? { token, userId: p.user_id } : null;
}

function projectRefFromUrl() {
  try { return new URL(SUPABASE_URL).hostname.split(".")[0]; } catch { return ""; }
}

async function management(path, options = {}) {
  const response = await fetch(`https://api.supabase.com${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${MANAGEMENT_TOKEN}`, "Content-Type": "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw || null; }
  return {
    ok: response.ok,
    status: response.status,
    data,
    requestId: response.headers.get("x-request-id") || response.headers.get("sb-request-id") || null,
  };
}

function sum(rows, key) { return (rows || []).reduce((n, row) => n + Number(row?.[key] || 0), 0); }
function firstNumber(rows, candidates) {
  const row = Array.isArray(rows) ? rows[0] : rows;
  for (const key of candidates) if (row?.[key] !== undefined && row?.[key] !== null) return Number(row[key]);
  return null;
}
function apiError(result) {
  const data = result?.data;
  if (typeof data === "string") return data.slice(0, 300);
  return String(data?.message || data?.error || data?.msg || data?.error_description || "").slice(0, 300);
}
function errorDetail(label, result) {
  const detail = apiError(result);
  return `${label}: HTTP ${result.status}${detail ? ` — ${detail}` : ""}${result.requestId ? ` [${result.requestId}]` : ""}`;
}
function publicFailure(errors, tokenWarning = "") {
  const joined = errors.join(" | ");
  if (/401/.test(joined)) return `Supabase recusou o token (HTTP 401). Confirme se SUPABASE_MANAGEMENT_TOKEN contém o Access Token gerado em Account → Access Tokens.${tokenWarning}`;
  if (/403/.test(joined)) return `O token foi reconhecido, mas não possui acesso suficiente ao projeto (HTTP 403). Confirme Project access e as permissões Usage Analytics: Read e Database: Read.${tokenWarning}`;
  if (/404/.test(joined)) return "O Supabase não encontrou o recurso solicitado (HTTP 404). Confira o Project Ref cadastrado no campo Identificador.";
  if (/429/.test(joined)) return "O limite temporário da Supabase Management API foi atingido (HTTP 429). Aguarde um minuto e tente novamente.";
  return `A coleta do Supabase falhou. ${joined || "A Management API não retornou dados utilizáveis."}${tokenWarning}`;
}

export async function POST(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return reply("Acesso ROOT necessário.", 403);
  if (!MANAGEMENT_TOKEN) return reply("Configure SUPABASE_MANAGEMENT_TOKEN na Vercel para ativar a coleta automática.", 503, { code: "SUPABASE_TOKEN_MISSING" });

  let body = {}; try { body = await request.json(); } catch {}
  if (!body.serviceId) return reply("Informe o serviço Supabase.", 400);

  const serviceResult = await rest(ctx.token, `nexus_infra_services?id=eq.${encodeURIComponent(body.serviceId)}&select=*&limit=1`);
  const service = serviceResult.data?.[0];
  if (!service) return reply("Serviço não encontrado.", 404);
  if (!String(service.provider || "").toLowerCase().includes("supabase")) return reply("O serviço selecionado não é Supabase.", 400);

  const planResult = await rest(ctx.token, `nexus_infra_plans?service_id=eq.${encodeURIComponent(service.id)}&is_active=eq.true&select=*&limit=1`);
  const plan = planResult.data?.[0] || null;
  const limits = plan?.consumption_limits || {};
  const ref = String(service.resource_identifier || projectRefFromUrl()).trim();
  if (!ref) return reply("Informe o Project Ref do Supabase no campo Identificador do serviço.", 400);

  const tokenWarning = /^sbp_/i.test(MANAGEMENT_TOKEN)
    ? ""
    : " O prefixo do segredo configurado também não corresponde ao formato sbp_ mostrado atualmente pela documentação da Management API; confirme que não foi colada uma chave de outro provedor.";

  const startedAt = new Date().toISOString();
  const run = await rest(ctx.token, "nexus_infra_sync_runs", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify([{ service_id: service.id, provider: "SUPABASE", status: "PARTIAL", started_at: startedAt, created_by: ctx.userId }]),
  });
  const runId = run.data?.[0]?.id;

  const metrics = [];
  const errors = [];
  const now = new Date().toISOString();
  const push = (key, label, unit, value) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
    metrics.push({ service_id: service.id, metric_key: key, metric_label: label, unit, used_value: Number(value), limit_value: limits[key] ?? null, source: "API", measured_at: now, created_by: ctx.userId });
  };

  const counts = await management(`/v1/projects/${encodeURIComponent(ref)}/analytics/endpoints/usage.api-counts?interval=1d`);
  if (counts.ok) {
    const rows = Array.isArray(counts.data?.result) ? counts.data.result : [];
    push("api_rest_requests", "Requisições REST", "req", sum(rows, "total_rest_requests"));
    push("auth_requests", "Requisições Auth", "req", sum(rows, "total_auth_requests"));
    push("realtime_requests", "Requisições Realtime", "req", sum(rows, "total_realtime_requests"));
    push("storage_requests", "Requisições Storage", "req", sum(rows, "total_storage_requests"));
  } else errors.push(errorDetail("Usage Analytics", counts));

  // O endpoint read-only é o endpoint oficial específico para database_read em tokens fine-grained.
  const db = await management(`/v1/projects/${encodeURIComponent(ref)}/database/query/read-only`, {
    method: "POST",
    body: JSON.stringify({ query: "select round(pg_database_size(current_database()) / 1073741824.0, 4) as database_size_gb" }),
  });
  if (db.ok) push("database_size_gb", "Banco de dados", "GB", firstNumber(db.data, ["database_size_gb"]));
  else errors.push(errorDetail("Database Read", db));

  const storage = await management(`/v1/projects/${encodeURIComponent(ref)}/database/query/read-only`, {
    method: "POST",
    body: JSON.stringify({ query: "select round(coalesce(sum((metadata->>'size')::numeric),0) / 1073741824.0, 4) as storage_size_gb from storage.objects" }),
  });
  if (storage.ok) push("storage_size_gb", "Storage", "GB", firstNumber(storage.data, ["storage_size_gb"]));
  else errors.push(errorDetail("Storage Read", storage));

  if (metrics.length) {
    const insert = await rest(ctx.token, "nexus_infra_consumption", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(metrics) });
    if (!insert.ok) errors.push(`Persistência PLENIUM: HTTP ${insert.status}`);
  }

  const status = metrics.length === 0 ? "ERROR" : errors.length ? "PARTIAL" : "SUCCESS";
  const diagnostic = errors.join(" | ") || "Coleta concluída.";
  if (runId) await rest(ctx.token, `nexus_infra_sync_runs?id=eq.${encodeURIComponent(runId)}`, {
    method: "PATCH", body: JSON.stringify({ status, metrics_count: metrics.length, message: diagnostic, finished_at: new Date().toISOString() }),
  });

  if (!metrics.length) return reply(publicFailure(errors, tokenWarning), 502, { code: "SUPABASE_SYNC_FAILED", errors, projectRef: ref });
  return NextResponse.json({ status, metricsCount: metrics.length, errors, measuredAt: now, warning: tokenWarning.trim() || null });
}
