import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(message, status, extra = {}) { return NextResponse.json({ message, ...extra }, { status }); }
function tokenOf(request) { return request.cookies.get("nexus_access_token")?.value || ""; }
function headers(key, auth = key) { return { apikey: key, Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }; }

async function requireRoot(request) {
  const token = tokenOf(request);
  if (!token || !URL || !KEY) return null;
  const response = await fetch(`${URL}/rest/v1/nexus_user_profiles?select=user_id,organization_id,profile,active&active=eq.true&limit=1`, {
    headers: headers(KEY, token), cache: "no-store",
  });
  if (!response.ok) return null;
  const profile = (await response.json())?.[0];
  if (!profile || !["NEXUS_ROOT", "NEXUS_ADMIN"].includes(profile.profile)) return null;
  return { token, userId: profile.user_id, organizationId: profile.organization_id };
}

async function rest(path, { method = "GET", body, prefer } = {}, authToken = null) {
  const key = SERVICE || KEY;
  const auth = SERVICE || authToken;
  const h = headers(key, auth);
  if (prefer) h.Prefer = prefer;
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
  });
  let data = null; try { data = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, data };
}

export async function GET(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return json("Acesso ROOT necessário.", 403);
  const [cases, runs] = await Promise.all([
    rest("nexus_ai_benchmark_cases?select=*&active=eq.true&order=sort_order.asc,title.asc", {}, ctx.token),
    rest("nexus_ai_benchmark_runs?select=*,case:nexus_ai_benchmark_cases(code,title,category),operation:nexus_ai_operations(status,provider_id,model_id)&order=created_at.desc&limit=100", {}, ctx.token),
  ]);
  if (!cases.ok || !runs.ok) return json("Execute a migration 20260908_003_plenium_ai_benchmark.sql.", 500, { details: cases.data || runs.data });

  const operationIds = (runs.data || []).map((x) => x.operation_id).filter(Boolean);
  let scores = [];
  if (operationIds.length) {
    const encoded = operationIds.join(",");
    const scoreResult = await rest(`nexus_ai_quality_scores?select=*&operation_id=in.(${encoded})`, {}, ctx.token);
    if (scoreResult.ok) scores = scoreResult.data || [];
  }
  const scoreMap = Object.fromEntries(scores.map((s) => [s.operation_id, s]));
  return NextResponse.json({
    cases: cases.data || [],
    runs: (runs.data || []).map((run) => ({ ...run, score: scoreMap[run.operation_id] || null })),
  });
}

export async function POST(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return json("Acesso ROOT necessário.", 403);
  if (!SERVICE) return json("SUPABASE_SERVICE_ROLE_KEY é necessária para registrar benchmark.", 503);
  let body; try { body = await request.json(); } catch { return json("JSON inválido.", 400); }
  if (!body?.operationId || !body?.prompt) return json("operationId e prompt são obrigatórios.", 400);

  const op = await rest(`nexus_ai_operations?select=id,organization_id,user_id,requested_level,input_tokens,output_tokens,cost_usd,latency_ms,fallback_used,status&id=eq.${encodeURIComponent(body.operationId)}&limit=1`, {}, ctx.token);
  const operation = op.data?.[0];
  if (!op.ok || !operation) return json("Operação de IA não encontrada.", 404);

  const payload = [{
    case_id: body.caseId || null,
    operation_id: operation.id,
    organization_id: operation.organization_id,
    user_id: operation.user_id || ctx.userId,
    prompt_snapshot: String(body.prompt),
    output_snapshot: body.output == null ? null : String(body.output),
    provider_code: body.provider || null,
    model_code: body.model || null,
    requested_level: Number(operation.requested_level ?? body.level ?? 1),
    input_tokens: Number(operation.input_tokens || 0),
    output_tokens: Number(operation.output_tokens || 0),
    cost_usd: Number(operation.cost_usd || 0),
    latency_ms: operation.latency_ms == null ? null : Number(operation.latency_ms),
    fallback_used: Boolean(operation.fallback_used),
  }];
  const result = await rest("nexus_ai_benchmark_runs", { method: "POST", body: payload, prefer: "return=representation" }, ctx.token);
  if (!result.ok) return json("Falha ao registrar benchmark.", result.status, { details: result.data });
  return NextResponse.json({ ok: true, run: result.data?.[0] }, { status: 201 });
}

export async function PATCH(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return json("Acesso ROOT necessário.", 403);
  if (!SERVICE) return json("SUPABASE_SERVICE_ROLE_KEY é necessária para avaliar benchmark.", 503);
  let body; try { body = await request.json(); } catch { return json("JSON inválido.", 400); }
  if (!body?.runId || !body?.operationId) return json("runId e operationId são obrigatórios.", 400);

  const clamp = (v) => Math.max(0, Math.min(100, Number(v || 0)));
  const accuracy = clamp(body.accuracy);
  const adherence = clamp(body.adherence);
  const quality = clamp(body.quality);
  const structure = clamp(body.structureScore);
  const stability = clamp(body.stability);
  const finalScore = (accuracy * 0.40) + (adherence * 0.27) + (quality * 0.20) + (structure * 0.07) + (stability * 0.06);

  const op = await rest(`nexus_ai_operations?select=id,model_id&id=eq.${encodeURIComponent(body.operationId)}&limit=1`, {}, ctx.token);
  const operation = op.data?.[0];
  if (!operation) return json("Operação não encontrada.", 404);

  const existing = await rest(`nexus_ai_quality_scores?select=id&operation_id=eq.${encodeURIComponent(body.operationId)}&limit=1`, {}, ctx.token);
  const scorePayload = {
    operation_id: body.operationId,
    model_id: operation.model_id || null,
    accuracy,
    adherence,
    quality,
    structure_score: structure,
    stability,
    final_score: Number(finalScore.toFixed(2)),
    evaluator: `ROOT:${ctx.userId}`,
  };
  let scoreResult;
  if (existing.data?.[0]?.id) {
    scoreResult = await rest(`nexus_ai_quality_scores?id=eq.${existing.data[0].id}`, { method: "PATCH", body: scorePayload, prefer: "return=representation" }, ctx.token);
  } else {
    scoreResult = await rest("nexus_ai_quality_scores", { method: "POST", body: [scorePayload], prefer: "return=representation" }, ctx.token);
  }
  if (!scoreResult.ok) return json("Falha ao salvar avaliação.", scoreResult.status, { details: scoreResult.data });

  await rest(`nexus_ai_benchmark_runs?id=eq.${encodeURIComponent(body.runId)}`, {
    method: "PATCH", body: { evaluator_notes: body.notes || null, evaluated_at: new Date().toISOString() }, prefer: "return=minimal",
  }, ctx.token);
  return NextResponse.json({ ok: true, score: scoreResult.data?.[0] || scorePayload });
}
