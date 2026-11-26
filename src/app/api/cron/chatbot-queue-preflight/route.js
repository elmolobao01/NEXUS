// Preflight for queued inbound jobs. Deliberately READ-ONLY: never claim,
// reserve credits, send to Meta, or finalize a job. Activation is a later step.
import { createTransactionalProductionReader } from "../../../../lib/chatbot/transactional-production-adapters.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const respond = (body, status=200) => Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGITS = /^\d{5,30}$/;
const PHONE = /^\d{7,20}$/;
export async function GET(request) {
  const secret=process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization")!==`Bearer ${secret}`) return respond({error:"Unauthorized"},401);
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return respond({error:"Unavailable"},503);
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  const read=async(table,query)=>{
    const r=await fetch(`${base}/rest/v1/${table}?${query}`,{headers,cache:"no-store"});
    if (!r.ok) throw new Error(`read_${table}_${r.status}`);
    const value=await r.json();
    if (!Array.isArray(value)) throw new Error(`invalid_${table}`);
    return value;
  };
  try {
    const reader=createTransactionalProductionReader({supabaseUrl:base,serviceRoleKey:key});
    const jobs=await read("nexus_chatbot_inbound_jobs","select=id,organization_id,phone_number_id,contact_phone,message_id,source_event_id,state,attempts&state=eq.pending&order=created_at.asc&limit=20");
    const decisions=[];
    for(const j of jobs){
      const d={job_id:j.id,eligible:false,reason:"invalid_identity"};
      decisions.push(d);
      if(!UUID.test(j.id)||!UUID.test(j.organization_id)||!UUID.test(j.source_event_id)||!DIGITS.test(j.phone_number_id)||!PHONE.test(j.contact_phone)||!j.message_id) continue;
      if(!Number.isInteger(j.attempts)||j.attempts<0||j.attempts>=3){d.reason="attempt_limit";continue;}
      const validated=await reader.revalidate(j);
      if(validated?.allow!==true){d.reason=validated?.reason||"revalidation_unavailable";continue;}
      const reply=await reader.selectReply(j,validated);
      if(reply?.allow!==true){d.reason=reply?.reason||"response_unavailable";continue;}
      d.eligible=true;d.reason="preflight_eligible";d.response_type=validated.response_type||null;
    }
    return respond({mode:"queue_preflight_read_only",jobs_scanned:jobs.length,decisions,sending_enabled:false,credits_debited:false,jobs_claimed:false,database_modified:false,production_ready:false});
  }catch(e){console.error("chatbot_queue_preflight_failed",e?.message||"unknown");return respond({error:"Preflight unavailable"},503);}
}
