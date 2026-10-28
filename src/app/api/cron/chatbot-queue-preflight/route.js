// Preflight for queued inbound jobs. Deliberately READ-ONLY: never claim,
// reserve credits, send to Meta, or finalize a job. Activation is a later step.
import { basicReply } from "../../portal/chatbot/basic-engine";
import { checkHumanPauseBeforeMetaSend } from "../../../../lib/chatbot/human-pause-send-guard";

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
  const one=async(table,query)=>{
    const rows=await read(table,`${query}&limit=2`);
    if(rows.length>1) throw new Error(`ambiguous_${table}`);
    return rows[0]||null;
  };
  try {
    const jobs=await read("nexus_chatbot_inbound_jobs","select=id,organization_id,phone_number_id,contact_phone,message_id,source_event_id,state,attempts&state=eq.pending&order=created_at.asc&limit=20");
    const decisions=[];
    for(const j of jobs){
      const d={job_id:j.id,eligible:false,reason:"invalid_identity"};
      decisions.push(d);
      if(!UUID.test(j.id)||!UUID.test(j.organization_id)||!UUID.test(j.source_event_id)||!DIGITS.test(j.phone_number_id)||!PHONE.test(j.contact_phone)||!j.message_id) continue;
      const org=encodeURIComponent(j.organization_id);
      const [event,connection,config,wallet]=await Promise.all([
        one("nexus_whatsapp_webhook_events",`select=id,organization_id,phone_number_id,event_payload&id=eq.${encodeURIComponent(j.source_event_id)}`),
        one("nexus_meta_whatsapp_connections",`select=organization_id,phone_number_id,connection_status,credential_reference&organization_id=eq.${org}&phone_number_id=eq.${encodeURIComponent(j.phone_number_id)}`),
        one("nexus_chatbot_configs",`select=active,welcome_message,closing_message,faq&organization_id=eq.${org}`),
        one("nexus_chatbot_message_wallets",`select=plan_code,cycle_start,cycle_end,included_remaining,prepaid_remaining&organization_id=eq.${org}`),
      ]);
      if(!event||event.organization_id!==j.organization_id||event.phone_number_id!==j.phone_number_id){d.reason="source_event_mismatch";continue;}
      const matches=(event.event_payload?.entry||[]).flatMap(e=>e.changes||[]).filter(c=>c.field==="messages"&&c.value?.metadata?.phone_number_id===j.phone_number_id).flatMap(c=>c.value?.messages||[]).filter(m=>m?.id===j.message_id&&m?.from===j.contact_phone);
      if(matches.length!==1){d.reason="source_message_ambiguous";continue;}
      if(!connection||connection.connection_status!=="active"||!connection.credential_reference){d.reason="connection_inactive";continue;}
      if(!config?.active){d.reason="chatbot_inactive";continue;}
      if(!wallet||!["CHATBOT_BASIC","CHATBOT_AI"].includes(wallet.plan_code)){d.reason="wallet_missing";continue;}
      const contract=await fetch(`${base}/rest/v1/rpc/nexus_chatbot_has_active_contract`,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({p_organization_id:j.organization_id,p_plan_code:wallet.plan_code}),cache:"no-store"});
      if(!contract.ok || await contract.json()!==true){d.reason="contract_inactive";continue;}
      const today=new Date().toISOString().slice(0,10);
      if(!(wallet.cycle_start<=today&&today<wallet.cycle_end&&(wallet.included_remaining>0||wallet.prepaid_remaining>0))){d.reason="wallet_unavailable";continue;}
      const pause=await checkHumanPauseBeforeMetaSend({organizationId:j.organization_id,phoneNumberId:j.phone_number_id,contactPhone:j.contact_phone});
      if(!pause.allow){d.reason=pause.reason;continue;}
      const msg=matches[0];
      if(msg.type!=="text"||typeof msg.text?.body!=="string"){d.reason="unsupported_message_type";continue;}
      const reply=basicReply(config,msg.text.body);
      if(!reply?.reply){d.reason="no_rule_reply";continue;}
      d.eligible=true;d.reason="preflight_eligible";d.response_type=reply.type||null;
    }
    return respond({mode:"queue_preflight_read_only",jobs_scanned:jobs.length,decisions,sending_enabled:false,credits_debited:false,jobs_claimed:false,database_modified:false,production_ready:false});
  }catch(e){console.error("chatbot_queue_preflight_failed",e?.message||"unknown");return respond({error:"Preflight unavailable"},503);}
}
