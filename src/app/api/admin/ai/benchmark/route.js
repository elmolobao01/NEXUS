import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(message, status, extra = {}) { return NextResponse.json({ message, ...extra }, { status }); }
function tokenOf(request) { return request.cookies.get("nexus_access_token")?.value || ""; }
function headers(key, auth = key) { return { apikey: key, Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }; }
function safeText(value){ return value == null ? "" : (typeof value === "string" ? value : JSON.stringify(value)); }

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

function parseJsonOutput(output){
  if(output && typeof output === "object") return { valid:true, value:output };
  if(typeof output !== "string") return { valid:false, value:null };
  const clean=output.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim();
  try { return { valid:true, value:JSON.parse(clean) }; } catch { return { valid:false, value:null }; }
}
function clamp(v){ return Math.max(0,Math.min(100,Number(v||0))); }
function autoEvaluate(caseCode, output){
  const text=safeText(output);
  const lower=text.toLowerCase();
  const parsed=parseJsonOutput(output);
  let accuracy=0, adherence=0, structure=0, details=[];

  if(caseCode === "TXT_CLASSIFY_01"){
    if(!parsed.valid || !parsed.value || Array.isArray(parsed.value)){
      details.push("JSON inválido ou resposta não estruturada");
      return { score:0, passed:false, accuracy:0, adherence:0, structure:0, details };
    }
    const categoria=String(parsed.value?.categoria||"").trim().toUpperCase();
    const justificativa=String(parsed.value?.justificativa||"").trim();
    const allowed=["FINANCEIRO","SUPORTE","COMERCIAL","OUTRO"];
    structure = (Object.prototype.hasOwnProperty.call(parsed.value,"categoria") && Object.prototype.hasOwnProperty.call(parsed.value,"justificativa")) ? 100 : 50;
    adherence = allowed.includes(categoria) && justificativa.length >= 12 ? 100 : 0;
    accuracy = categoria === "FINANCEIRO" ? 100 : 0;
    details.push("JSON válido");
    details.push(allowed.includes(categoria) ? `Categoria permitida: ${categoria}` : "Categoria fora do conjunto permitido");
    details.push(accuracy===100 ? "Categoria FINANCEIRO correta" : "Categoria esperada FINANCEIRO não encontrada");
    details.push(justificativa.length>=12 ? "Justificativa presente" : "Justificativa ausente ou insuficiente");
  } else if(caseCode === "DATA_EXTRACT_01"){
    if(!parsed.valid || !parsed.value || Array.isArray(parsed.value)){
      details.push("JSON inválido ou resposta não estruturada");
      return { score:0, passed:false, accuracy:0, adherence:0, structure:0, details };
    }
    const v=parsed.value||{};
    const checks=[
      String(v.empresa||"").toLowerCase().includes("horizonte serviços"),
      String(v.cidade||"").toLowerCase().includes("feira de santana"),
      Number(v.quantidade_unidades)===8,
      Number(v.prazo_dias)===30,
    ];
    accuracy=(checks.filter(Boolean).length/checks.length)*100;
    structure=Object.keys(v).length>=4?100:50;
    adherence=checks.length===4 && structure===100?100:50;
    details.push("JSON válido");
    details.push(`${checks.filter(Boolean).length}/4 campos corretos`);
  } else if(caseCode === "ANALYSIS_SIMPLE_01"){
    const hasExpected=/25(?:[,.]0+)?\s*%/.test(lower) && lower.includes("março") && lower.includes("abril");
    accuracy = hasExpected ? 100 : 0;
    adherence = (lower.includes("128") && lower.includes("160")) ? 100 : 50;
    structure = text.trim().length > 20 ? 100 : 0;
    details.push(hasExpected ? "Variação Março→Abril de 25% identificada" : "Variação esperada de 25% não identificada");
  } else if(caseCode === "TXT_SUMMARY_01"){
    const facts=["5 de setembro","12","ana","10 de setembro","marcos","11","12 de setembro"];
    const hits=facts.filter(x=>lower.includes(x)).length;
    accuracy=(hits/facts.length)*100;
    const bulletCount=(text.match(/^\s*[-•*]|^\s*\d+[.)]/gm)||[]).length;
    adherence=bulletCount>0 && bulletCount<=4 ? 100 : 50;
    structure=text.trim().length>20?100:0;
    details.push(`${hits}/${facts.length} fatos-chave preservados`);
    details.push(bulletCount>0 && bulletCount<=4 ? "Formato resumido aderente" : "Formato do resumo fora do esperado");
  } else if(caseCode === "COMM_DRAFT_01"){
    const facts=[lower.includes("amanhã"),lower.includes("22h"),lower.includes("23h"),lower.includes("indispon")];
    accuracy=(facts.filter(Boolean).length/facts.length)*100;
    adherence=accuracy===100?100:50;
    structure=text.trim().length>30?100:0;
    details.push(`${facts.filter(Boolean).length}/4 informações obrigatórias presentes`);
  } else {
    structure=text.trim().length?100:0;
    adherence=structure;
    accuracy=structure;
    details.push("Avaliação automática genérica");
  }

  const score=(clamp(accuracy)*0.55)+(clamp(adherence)*0.25)+(clamp(structure)*0.20);
  return {
    score:Number(score.toFixed(2)),
    passed:score>=80,
    accuracy:Number(clamp(accuracy).toFixed(2)),
    adherence:Number(clamp(adherence).toFixed(2)),
    structure:Number(clamp(structure).toFixed(2)),
    details
  };
}

async function backfillAutoScores(runs, authToken){
  if(!SERVICE || !Array.isArray(runs) || !runs.length) return runs || [];
  const pending=runs.filter(run=>run?.id && run?.case?.code && run.auto_score == null && run.output_snapshot != null);
  if(!pending.length) return runs;
  const computed=new Map();
  for(const run of pending){
    const auto=autoEvaluate(run.case.code, run.output_json ?? run.output_snapshot);
    computed.set(run.id,auto);
    await rest(`nexus_ai_benchmark_runs?id=eq.${encodeURIComponent(run.id)}`,{
      method:"PATCH",
      body:{auto_score:auto.score,auto_pass:auto.passed,auto_details:auto},
      prefer:"return=minimal",
    },authToken);
  }
  return runs.map(run=>{
    const auto=computed.get(run.id);
    return auto ? {...run,auto_score:auto.score,auto_pass:auto.passed,auto_details:auto} : run;
  });
}

function buildRanking(runs){
  const byModel=new Map();
  for(const run of runs){
    if(!run.model_code) continue;
    const item=byModel.get(run.model_code)||{model:run.model_code,provider:run.provider_code,runs:0,cost:0,latency:0,autoQuality:0,autoRuns:0,humanQuality:0,humanRuns:0,effectiveQuality:0,passes:0};
    const hasHuman=run.score?.final_score != null;
    const hasAuto=run.auto_score != null;
    const autoQuality=hasAuto?Number(run.auto_score):0;
    const humanQuality=hasHuman?Number(run.score.final_score):null;
    const effective=hasHuman?humanQuality:autoQuality;
    item.runs+=1;
    item.cost+=Number(run.cost_usd||0);
    item.latency+=Number(run.latency_ms||0);
    item.effectiveQuality+=Number(effective||0);
    if(hasAuto){ item.autoQuality+=autoQuality; item.autoRuns+=1; }
    if(hasHuman){ item.humanQuality+=humanQuality; item.humanRuns+=1; }
    if(run.auto_pass===true) item.passes+=1;
    byModel.set(run.model_code,item);
  }
  const rows=[...byModel.values()].map(x=>({
    ...x,
    avgCost:x.runs?x.cost/x.runs:0,
    avgLatency:x.runs?x.latency/x.runs:0,
    avgAutoQuality:x.autoRuns?x.autoQuality/x.autoRuns:0,
    avgHumanQuality:x.humanRuns?x.humanQuality/x.humanRuns:null,
    avgQuality:x.runs?x.effectiveQuality/x.runs:0,
    passRate:x.runs?(x.passes/x.runs)*100:0,
  }));
  if(!rows.length) return [];
  const positiveCosts=rows.filter(x=>x.avgCost>0).map(x=>x.avgCost);
  const positiveLatencies=rows.filter(x=>x.avgLatency>0).map(x=>x.avgLatency);
  const minCost=positiveCosts.length?Math.min(...positiveCosts):1;
  const minLatency=positiveLatencies.length?Math.min(...positiveLatencies):1;
  return rows.map(x=>{
    const costScore=x.avgCost>0?Math.min(100,(minCost/x.avgCost)*100):100;
    const latencyScore=x.avgLatency>0?Math.min(100,(minLatency/x.avgLatency)*100):100;
    const ranking=(x.avgQuality*0.70)+(costScore*0.20)+(latencyScore*0.10);
    return {...x,rankingScore:Number(ranking.toFixed(2))};
  }).sort((a,b)=>b.rankingScore-a.rankingScore);
}

export async function GET(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return json("Acesso ROOT necessário.", 403);
  const [cases, runs, models] = await Promise.all([
    rest("nexus_ai_benchmark_cases?select=*&active=eq.true&order=sort_order.asc,title.asc", {}, ctx.token),
    rest("nexus_ai_benchmark_runs?select=*,case:nexus_ai_benchmark_cases(code,title,category),operation:nexus_ai_operations(status,provider_id,model_id)&order=created_at.desc&limit=250", {}, ctx.token),
    rest("nexus_ai_models?select=id,code,name,level,active,input_cost_per_million,output_cost_per_million,provider:nexus_ai_providers(id,code,name,active)&active=eq.true&order=level.asc,name.asc", {}, ctx.token),
  ]);
  if (!cases.ok || !runs.ok) return json("Execute as migrations do Benchmark PLENIUM AI.", 500, { details: cases.data || runs.data });

  const operationIds = (runs.data || []).map((x) => x.operation_id).filter(Boolean);
  let scores = [];
  if (operationIds.length) {
    const encoded = operationIds.join(",");
    const scoreResult = await rest(`nexus_ai_quality_scores?select=*&operation_id=in.(${encoded})`, {}, ctx.token);
    if (scoreResult.ok) scores = scoreResult.data || [];
  }
  const scoreMap = Object.fromEntries(scores.map((s) => [s.operation_id, s]));
  let decoratedRuns=(runs.data || []).map((run) => ({ ...run, score: scoreMap[run.operation_id] || null }));
  decoratedRuns=await backfillAutoScores(decoratedRuns,ctx.token);
  return NextResponse.json({
    cases: cases.data || [],
    models:(models.ok?models.data:[]).filter(x=>x?.provider?.active),
    runs:decoratedRuns,
    ranking:buildRanking(decoratedRuns),
  });
}

export async function POST(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return json("Acesso ROOT necessário.", 403);
  if (!SERVICE) return json("SUPABASE_SERVICE_ROLE_KEY é necessária para registrar benchmark.", 503);
  let body; try { body = await request.json(); } catch { return json("JSON inválido.", 400); }
  if (!body?.caseId || !body?.operationId || !body?.prompt) return json("caseId, operationId e prompt são obrigatórios.", 400);

  const op = await rest(`nexus_ai_operations?select=id,organization_id,user_id,requested_level,input_tokens,output_tokens,cost_usd,latency_ms,fallback_used,status&id=eq.${encodeURIComponent(body.operationId)}&limit=1`, {}, ctx.token);
  const operation = op.data?.[0];
  if (!op.ok || !operation) return json("Operação de IA não encontrada.", 404);
  const caseRow=(await rest(`nexus_ai_benchmark_cases?select=id,code&id=eq.${encodeURIComponent(body.caseId)}&limit=1`,{},ctx.token)).data?.[0];
  const auto=autoEvaluate(caseRow?.code, body.output);
  const outputSnapshot=safeText(body.output);
  const parsed=parseJsonOutput(body.output);

  const payload = [{
    case_id: body.caseId || null,
    operation_id: operation.id,
    organization_id: operation.organization_id,
    user_id: operation.user_id || ctx.userId,
    prompt_snapshot: String(body.prompt),
    output_snapshot: outputSnapshot,
    output_json: parsed.valid ? parsed.value : null,
    provider_code: body.provider || null,
    model_code: body.model || null,
    requested_level: Number(operation.requested_level ?? body.level ?? 1),
    input_tokens: Number(operation.input_tokens || 0),
    output_tokens: Number(operation.output_tokens || 0),
    cost_usd: Number(operation.cost_usd || 0),
    latency_ms: operation.latency_ms == null ? null : Number(operation.latency_ms),
    fallback_used: Boolean(operation.fallback_used),
    auto_score:auto.score,
    auto_pass:auto.passed,
    auto_details:auto,
  }];
  const result = await rest("nexus_ai_benchmark_runs", { method: "POST", body: payload, prefer: "return=representation" }, ctx.token);
  if (!result.ok) return json("Falha ao registrar benchmark.", result.status, { details: result.data });
  return NextResponse.json({ ok: true, run: result.data?.[0], auto }, { status: 201 });
}

export async function PATCH(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return json("Acesso ROOT necessário.", 403);
  if (!SERVICE) return json("SUPABASE_SERVICE_ROLE_KEY é necessária para avaliar benchmark.", 503);
  let body; try { body = await request.json(); } catch { return json("JSON inválido.", 400); }
  if (!body?.runId || !body?.operationId) return json("runId e operationId são obrigatórios.", 400);

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
    accuracy, adherence, quality, structure_score: structure, stability,
    final_score: Number(finalScore.toFixed(2)), evaluator: `ROOT:${ctx.userId}`,
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
