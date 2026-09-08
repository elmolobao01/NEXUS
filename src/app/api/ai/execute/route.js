import { NextResponse } from "next/server";
import { normalizeAiRequest } from "@/core/ia/config";
import { executeProvider } from "@/core/ia/router";
import { estimateTokenCost } from "@/core/ia/cost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function bearer(r){ const h=r.headers.get("authorization")||""; return h.startsWith("Bearer ")?h.slice(7):null; }

function supabaseHeaders({ apiKey, authToken, prefer } = {}){
  const headers = {
    apikey: apiKey,
    "Content-Type": "application/json",
  };
  if(authToken) headers.Authorization = `Bearer ${authToken}`;
  if(prefer) headers.Prefer = prefer;
  return headers;
}

async function sb(path,{apiKey=SERVICE,authToken=SERVICE,method="GET",body,prefer}={}){
  if(!URL || !apiKey) throw new Error("SUPABASE_CONFIG_MISSING");
  const r=await fetch(`${URL}/rest/v1/${path}`,{
    method,
    headers:supabaseHeaders({apiKey,authToken,prefer}),
    body:body?JSON.stringify(body):undefined,
    cache:"no-store"
  });
  let data=null; try{data=await r.json();}catch{}
  if(!r.ok) throw new Error(`SUPABASE_${r.status}:${JSON.stringify(data)}`);
  return data;
}

async function context(request){
  const token=bearer(request) || request.cookies.get("nexus_access_token")?.value || null;
  if(!token||!URL||!PUBLIC_KEY||!SERVICE) return null;

  // A chave pública identifica o projeto (apikey) e o cookie/Bearer identifica o usuário.
  // Antes, o access token do usuário era enviado também como apikey, causando SUPABASE_401.
  const rows=await sb(
    "nexus_user_profiles?select=user_id,organization_id,profile,active&active=eq.true&limit=1",
    {apiKey:PUBLIC_KEY,authToken:token}
  );
  const p=rows?.[0];
  return p?.user_id&&p?.organization_id
    ? {token,userId:p.user_id,organizationId:p.organization_id,profile:p.profile}
    : null;
}
async function chooseRoute(level,operationType){
  const op=encodeURIComponent(operationType);
  const select="id,level,min_quality_score,model:nexus_ai_models!nexus_ai_routes_model_id_fkey(id,code,name,active,input_cost_per_million,output_cost_per_million,provider:nexus_ai_providers(id,code,name,active)),fallback:nexus_ai_models!nexus_ai_routes_fallback_model_id_fkey(id,code,name,active,input_cost_per_million,output_cost_per_million,provider:nexus_ai_providers(id,code,name,active))";
  const rows=await sb(`nexus_ai_routes?select=${select}&active=eq.true&level=lte.${level}&operation_type=in.(${op},*)&order=level.desc,priority.asc&limit=10`);
  return (rows||[]).find(r=>r?.model?.active&&r?.model?.provider?.active)||null;
}
async function enforceLimit(orgId, operationType){
  const limits=await sb(`nexus_ai_client_limits?select=*&organization_id=eq.${orgId}&active=eq.true&operation_type=in.(${encodeURIComponent(operationType)},*)`);
  if(!limits?.length) return;
  const start=new Date(); start.setUTCDate(1); start.setUTCHours(0,0,0,0);
  const ops=await sb(`nexus_ai_operations?select=id,cost_usd,input_tokens,output_tokens&organization_id=eq.${orgId}&created_at=gte.${encodeURIComponent(start.toISOString())}&status=in.(SUCCESS,RUNNING)`);
  const usage={operations:ops?.length||0,cost:(ops||[]).reduce((s,x)=>s+Number(x.cost_usd||0),0),input:(ops||[]).reduce((s,x)=>s+Number(x.input_tokens||0),0),output:(ops||[]).reduce((s,x)=>s+Number(x.output_tokens||0),0)};
  for(const l of limits){
    const exceeded=(l.monthly_operations!=null&&usage.operations>=Number(l.monthly_operations))||(l.monthly_cost_usd!=null&&usage.cost>=Number(l.monthly_cost_usd))||(l.monthly_input_tokens!=null&&usage.input>=Number(l.monthly_input_tokens))||(l.monthly_output_tokens!=null&&usage.output>=Number(l.monthly_output_tokens));
    if(exceeded&&l.hard_limit) throw new Error("AI_CLIENT_LIMIT_EXCEEDED");
  }
}
function modelCost(model,result){ return estimateTokenCost({inputTokens:result.inputTokens,outputTokens:result.outputTokens,inputCostPerMillion:model.input_cost_per_million,outputCostPerMillion:model.output_cost_per_million}); }

export async function POST(request){
  const started=Date.now(); let op=null;
  try{
    const ctx=await context(request); if(!ctx) return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
    const req=normalizeAiRequest(await request.json());
    await enforceLimit(ctx.organizationId,req.operationType);
    const route=await chooseRoute(req.level,req.operationType); if(!route?.model?.provider) return NextResponse.json({error:"AI_ROUTE_NOT_FOUND"},{status:503});
    [op]=await sb("nexus_ai_operations",{method:"POST",body:[{organization_id:ctx.organizationId,user_id:ctx.userId,operation_type:req.operationType,requested_level:req.level,status:"RUNNING",provider_id:route.model.provider.id,model_id:route.model.id,metadata:req.metadata}],prefer:"return=representation"});

    let selected=route.model, result, fallbackUsed=false;
    try{
      result=await executeProvider(selected.provider.code,{input:req.input,operationType:req.operationType,metadata:req.metadata,modelCode:selected.code});
    }catch(primaryError){
      const fallback=route.fallback;
      if(!fallback?.active||!fallback?.provider?.active) throw primaryError;
      await sb("nexus_ai_fallbacks",{method:"POST",body:[{operation_id:op.id,from_model_id:selected.id,to_model_id:fallback.id,reason:String(primaryError.message||primaryError).slice(0,500)}]});
      selected=fallback; fallbackUsed=true;
      result=await executeProvider(selected.provider.code,{input:req.input,operationType:req.operationType,metadata:req.metadata,modelCode:selected.code});
    }

    const cost=modelCost(selected,result);
    await sb(`nexus_ai_operations?id=eq.${op.id}`,{method:"PATCH",body:{status:"SUCCESS",provider_id:selected.provider.id,model_id:selected.id,input_tokens:result.inputTokens||0,output_tokens:result.outputTokens||0,cost_usd:cost,latency_ms:Date.now()-started,fallback_used:fallbackUsed,completed_at:new Date().toISOString()}});
    await sb("nexus_ai_usage",{method:"POST",body:[{operation_id:op.id,organization_id:ctx.organizationId,provider_id:selected.provider.id,model_id:selected.id,input_tokens:result.inputTokens||0,output_tokens:result.outputTokens||0}]});
    await sb("nexus_ai_costs",{method:"POST",body:[{operation_id:op.id,organization_id:ctx.organizationId,provider_cost_usd:cost}]});
    const latencyMs=Date.now()-started;
    return NextResponse.json({operationId:op.id,output:result.output,model:selected.code,provider:selected.provider.code,fallbackUsed,latencyMs,usage:{inputTokens:result.inputTokens||0,outputTokens:result.outputTokens||0,costUsd:cost}},{headers:{"Cache-Control":"no-store"}});
  }catch(e){
    if(op?.id){try{await sb(`nexus_ai_operations?id=eq.${op.id}`,{method:"PATCH",body:{status:"FAILED",error_code:String(e.message).slice(0,500),latency_ms:Date.now()-started,completed_at:new Date().toISOString()}});}catch{}}
    const message=String(e.message||"AI_EXECUTION_FAILED"); const code=message.includes("INVALID")?400:message.includes("LIMIT_EXCEEDED")?429:500;
    return NextResponse.json({error:message},{status:code});
  }
}
