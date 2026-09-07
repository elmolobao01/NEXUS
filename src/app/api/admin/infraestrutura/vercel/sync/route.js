import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || "";

function headers(token, extra = {}) { return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra }; }
function getToken(request) { return request.cookies.get("nexus_access_token")?.value || ""; }
async function requireRoot(request) {
  const token = getToken(request); if (!token || !SUPABASE_URL || !SUPABASE_KEY) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/nexus_user_profiles?select=user_id,profile,active&limit=1`, { headers: headers(token), cache: "no-store" });
  if (!r.ok) return null; const rows = await r.json(); const p = rows?.[0];
  return p?.active && ["NEXUS_ROOT","NEXUS_ADMIN"].includes(p.profile) ? { token, userId: p.user_id } : null;
}
async function sb(token, path, options={}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: headers(token, options.headers || {}), cache:"no-store" });
  let data=null; try { data=await r.json(); } catch {} return { ok:r.ok, status:r.status, data };
}
async function vercel(path) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.vercel.com${path}${VERCEL_TEAM_ID ? `${sep}teamId=${encodeURIComponent(VERCEL_TEAM_ID)}` : ""}`;
  const r = await fetch(url, { headers: { Authorization:`Bearer ${VERCEL_TOKEN}`, "Content-Type":"application/json" }, cache:"no-store" });
  let data=null; try { data=await r.json(); } catch {} if (!r.ok) throw new Error(data?.error?.message || `Vercel HTTP ${r.status}`); return data;
}
export async function POST(request) {
  const ctx = await requireRoot(request); if (!ctx) return NextResponse.json({message:"Acesso ROOT necessário."},{status:403});
  if (!VERCEL_TOKEN) return NextResponse.json({message:"Configure VERCEL_API_TOKEN na Vercel antes de sincronizar."},{status:400});
  let body={}; try { body=await request.json(); } catch {}
  const serviceId=body.serviceId; if (!serviceId) return NextResponse.json({message:"Serviço Vercel não informado."},{status:400});
  const serviceResult=await sb(ctx.token, `nexus_infra_services?id=eq.${encodeURIComponent(serviceId)}&select=*&limit=1`);
  const service=serviceResult.data?.[0]; if (!service) return NextResponse.json({message:"Serviço não encontrado."},{status:404});
  const projectRef=String(service.resource_identifier||"").trim(); if (!projectRef) return NextResponse.json({message:"Informe o Project ID ou nome do projeto no campo Identificador do serviço Vercel."},{status:400});
  const startedAt=new Date().toISOString();
  try {
    const project=await vercel(`/v9/projects/${encodeURIComponent(projectRef)}`);
    const projectId=project.id || projectRef;
    const deployments=await vercel(`/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=5&target=production`);
    const list=Array.isArray(deployments?.deployments)?deployments.deployments:[];
    const latest=list[0]||null;
    const state=String(latest?.readyState||latest?.state||"").toUpperCase();
    const health=state === "READY" ? "ONLINE" : ["ERROR","CANCELED"].includes(state) ? "OFFLINE" : latest ? "ATTENTION" : "UNKNOWN";
    const metadata={ ...(service.metadata||{}), vercel:{ projectId, projectName:project.name||projectRef, framework:project.framework||null, nodeVersion:project.nodeVersion||null, latestDeploymentId:latest?.uid||latest?.id||null, latestDeploymentUrl:latest?.url||null, latestState:state||null, latestTarget:latest?.target||null, latestCreatedAt:latest?.created||latest?.createdAt||null, gitCommitSha:latest?.meta?.githubCommitSha||latest?.meta?.gitCommitSha||null, gitCommitMessage:latest?.meta?.githubCommitMessage||latest?.meta?.gitCommitMessage||null, gitBranch:latest?.meta?.githubCommitRef||latest?.meta?.gitCommitRef||null, syncedAt:new Date().toISOString() } };
    await sb(ctx.token, `nexus_infra_services?id=eq.${encodeURIComponent(serviceId)}`, { method:"PATCH", headers:{Prefer:"return=minimal"}, body:JSON.stringify({health_status:health,last_checked_at:new Date().toISOString(),metadata}) });
    await sb(ctx.token, "nexus_infra_sync_runs", { method:"POST", headers:{Prefer:"return=minimal"}, body:JSON.stringify([{service_id:serviceId,provider:"VERCEL",status:"SUCCESS",metrics_count:1,message:`Projeto ${project.name||projectRef}; deployment ${state||"sem estado"}.`,started_at:startedAt,finished_at:new Date().toISOString(),created_by:ctx.userId}]) });
    return NextResponse.json({status:"SUCCESS",project:{id:projectId,name:project.name},deployment:latest?{id:latest.uid||latest.id,url:latest.url,state,branch:metadata.vercel.gitBranch,commit:metadata.vercel.gitCommitSha}:null});
  } catch(error) {
    await sb(ctx.token, "nexus_infra_sync_runs", { method:"POST", headers:{Prefer:"return=minimal"}, body:JSON.stringify([{service_id:serviceId,provider:"VERCEL",status:"ERROR",metrics_count:0,message:String(error.message||error),started_at:startedAt,finished_at:new Date().toISOString(),created_by:ctx.userId}]) });
    await sb(ctx.token, `nexus_infra_services?id=eq.${encodeURIComponent(serviceId)}`, {method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({health_status:"ATTENTION",last_checked_at:new Date().toISOString()})});
    return NextResponse.json({message:`Falha na sincronização Vercel: ${error.message}`},{status:502});
  }
}
