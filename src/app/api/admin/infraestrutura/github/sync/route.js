import { NextResponse } from "next/server";

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const GITHUB_TOKEN=process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN;
function headers(token,extra={}){return{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json",...extra};}
function getToken(request){return request.cookies.get("nexus_access_token")?.value||"";}
async function requireRoot(request){const token=getToken(request);if(!token||!SUPABASE_URL||!SUPABASE_KEY)return null;const r=await fetch(`${SUPABASE_URL}/rest/v1/nexus_user_profiles?select=user_id,profile,active&limit=1`,{headers:headers(token),cache:"no-store"});if(!r.ok)return null;const p=(await r.json())?.[0];return p?.active&&["NEXUS_ROOT","NEXUS_ADMIN"].includes(p.profile)?{token,userId:p.user_id}:null;}
async function sb(token,path,options={}){const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers:headers(token,options.headers||{}),cache:"no-store"});let data=null;try{data=await r.json();}catch{}return{ok:r.ok,status:r.status,data};}
async function github(path){const h={Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2026-03-10","User-Agent":"PLENIUM-ROOT-Infrastructure"};if(GITHUB_TOKEN)h.Authorization=`Bearer ${GITHUB_TOKEN}`;const r=await fetch(`https://api.github.com${path}`,{headers:h,cache:"no-store"});let data=null;try{data=await r.json();}catch{}if(!r.ok)throw new Error(data?.message||`GitHub HTTP ${r.status}`);return{data,headers:r.headers};}
export async function POST(request){
 const ctx=await requireRoot(request);if(!ctx)return NextResponse.json({message:"Acesso ROOT necessário."},{status:403});
 let body={};try{body=await request.json();}catch{}const serviceId=body.serviceId;if(!serviceId)return NextResponse.json({message:"Serviço GitHub não informado."},{status:400});
 const sr=await sb(ctx.token,`nexus_infra_services?id=eq.${encodeURIComponent(serviceId)}&select=*&limit=1`);const service=sr.data?.[0];if(!service)return NextResponse.json({message:"Serviço não encontrado."},{status:404});
 const repo=String(service.resource_identifier||"").trim().replace(/^https?:\/\/github\.com\//i,"").replace(/\.git$/i,"").replace(/^\/+|\/+$/g,"");
 if(!/^[^/]+\/[^/]+$/.test(repo))return NextResponse.json({message:"No Identificador do serviço GitHub, informe owner/repositorio (ex.: elmolobao01/NEXUS)."},{status:400});
 const startedAt=new Date().toISOString();
 try{
  const repository=(await github(`/repos/${repo}`)).data;
  const commits=(await github(`/repos/${repo}/commits?sha=${encodeURIComponent(repository.default_branch||"main")}&per_page=5`)).data;
  const latest=Array.isArray(commits)?commits[0]:null;
  const metadata={...(service.metadata||{}),github:{fullName:repository.full_name||repo,private:Boolean(repository.private),defaultBranch:repository.default_branch||null,visibility:repository.visibility||null,openIssues:repository.open_issues_count??null,pushedAt:repository.pushed_at||null,updatedAt:repository.updated_at||null,latestCommitSha:latest?.sha||null,latestCommitMessage:latest?.commit?.message||null,latestCommitAuthor:latest?.commit?.author?.name||latest?.author?.login||null,latestCommitAt:latest?.commit?.author?.date||null,htmlUrl:repository.html_url||null,syncedAt:new Date().toISOString()}};
  await sb(ctx.token,`nexus_infra_services?id=eq.${encodeURIComponent(serviceId)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({health_status:"ONLINE",last_checked_at:new Date().toISOString(),metadata})});
  await sb(ctx.token,"nexus_infra_sync_runs",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify([{service_id:serviceId,provider:"GITHUB",status:"SUCCESS",metrics_count:1,message:`${repository.full_name||repo}; branch ${repository.default_branch||"—"}; commit ${latest?.sha?.slice(0,7)||"—"}.`,started_at:startedAt,finished_at:new Date().toISOString(),created_by:ctx.userId}])});
  return NextResponse.json({status:"SUCCESS",repository:{fullName:repository.full_name,defaultBranch:repository.default_branch,private:repository.private},commit:latest?{sha:latest.sha,message:latest.commit?.message,date:latest.commit?.author?.date}:null});
 }catch(error){
  await sb(ctx.token,"nexus_infra_sync_runs",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify([{service_id:serviceId,provider:"GITHUB",status:"ERROR",metrics_count:0,message:String(error.message||error),started_at:startedAt,finished_at:new Date().toISOString(),created_by:ctx.userId}])});
  await sb(ctx.token,`nexus_infra_services?id=eq.${encodeURIComponent(serviceId)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({health_status:"ATTENTION",last_checked_at:new Date().toISOString()})});
  return NextResponse.json({message:`Falha na sincronização GitHub: ${error.message}`},{status:502});
 }
}
