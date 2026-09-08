import { NextResponse } from "next/server";
import { normalizeAiRequest } from "@/core/ia/config";
import { executeProvider } from "@/core/ia/router";
import { estimateTokenCost } from "@/core/ia/cost";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL; const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
function bearer(r){ const h=r.headers.get("authorization")||""; return h.startsWith("Bearer ")?h.slice(7):null; }
function h(token){ return {apikey:token,Authorization:`Bearer ${token}`,"Content-Type":"application/json"}; }
async function sb(path,{token=SERVICE,method="GET",body,prefer}={}){ const headers=h(token); if(prefer) headers.Prefer=prefer; const r=await fetch(`${URL}/rest/v1/${path}`,{method,headers,body:body?JSON.stringify(body):undefined,cache:"no-store"}); let data=null; try{data=await r.json();}catch{} if(!r.ok) throw new Error(`SUPABASE_${r.status}:${JSON.stringify(data)}`); return data; }
async function context(request){ const token=bearer(request); if(!token||!URL||!KEY||!SERVICE) return null; const rows=await sb("nexus_user_profiles?select=user_id,organization_id,profile,active&active=eq.true&limit=1",{token}); const p=rows?.[0]; return p?.user_id&&p?.organization_id?{token,userId:p.user_id,organizationId:p.organization_id,profile:p.profile}:null; }
async function chooseRoute(level,operationType){ const q=`nexus_ai_routes?select=id,level,min_quality_score,model:nexus_ai_models(id,code,name,input_cost_per_million,output_cost_per_million,provider:nexus_ai_providers(id,code,name))&active=eq.true&level=lte.${level}&operation_type=in.(${encodeURIComponent(operationType)},*)&order=level.desc,priority.asc&limit=1`; const rows=await sb(q); return rows?.[0]||null; }
export async function POST(request){
  const started=Date.now(); let op=null;
  try{
    const ctx=await context(request); if(!ctx) return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
    const req=normalizeAiRequest(await request.json()); const route=await chooseRoute(req.level,req.operationType); if(!route?.model?.provider) return NextResponse.json({error:"AI_ROUTE_NOT_FOUND"},{status:503});
    [op]=await sb("nexus_ai_operations",{method:"POST",body:[{organization_id:ctx.organizationId,user_id:ctx.userId,operation_type:req.operationType,requested_level:req.level,status:"RUNNING",provider_id:route.model.provider.id,model_id:route.model.id,metadata:req.metadata}],prefer:"return=representation"});
    const result=await executeProvider(route.model.provider.code,{input:req.input,operationType:req.operationType,metadata:req.metadata});
    const cost=estimateTokenCost({inputTokens:result.inputTokens,outputTokens:result.outputTokens,inputCostPerMillion:route.model.input_cost_per_million,outputCostPerMillion:route.model.output_cost_per_million});
    await sb(`nexus_ai_operations?id=eq.${op.id}`,{method:"PATCH",body:{status:"SUCCESS",input_tokens:result.inputTokens||0,output_tokens:result.outputTokens||0,cost_usd:cost,latency_ms:Date.now()-started,completed_at:new Date().toISOString()}});
    await sb("nexus_ai_usage",{method:"POST",body:[{operation_id:op.id,organization_id:ctx.organizationId,provider_id:route.model.provider.id,model_id:route.model.id,input_tokens:result.inputTokens||0,output_tokens:result.outputTokens||0}]});
    await sb("nexus_ai_costs",{method:"POST",body:[{operation_id:op.id,organization_id:ctx.organizationId,provider_cost_usd:cost}]});
    return NextResponse.json({operationId:op.id,output:result.output,model:route.model.code,provider:route.model.provider.code,usage:{inputTokens:result.inputTokens||0,outputTokens:result.outputTokens||0,costUsd:cost}},{headers:{"Cache-Control":"no-store"}});
  }catch(e){ if(op?.id){ try{await sb(`nexus_ai_operations?id=eq.${op.id}`,{method:"PATCH",body:{status:"FAILED",error_code:String(e.message).slice(0,500),latency_ms:Date.now()-started,completed_at:new Date().toISOString()}});}catch{} } const code=String(e.message).includes("INVALID")?400:500; return NextResponse.json({error:String(e.message||"AI_EXECUTION_FAILED")},{status:code}); }
}
