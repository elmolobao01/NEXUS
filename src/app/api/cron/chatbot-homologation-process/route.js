import { timingSafeEqual } from 'node:crypto';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ROOT='7ca2ee92-6b12-4f54-ba7b-986bab2f9434';
const PHONE='1295394797000036';
const respond=(obj,status=200)=>Response.json(obj,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req){
 const expected=process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
 const supplied=req.headers.get('authorization')||'';
 if(!expected || Buffer.byteLength(supplied)!==Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) return respond({error:'Unauthorized'},401);
 if(process.env.CHATBOT_HOMOLOGATION_PROCESS_ENABLED!=='true' ||
    process.env.CHATBOT_HOMOLOGATION_ORGANIZATION_ID!==ROOT ||
    process.env.CHATBOT_HOMOLOGATION_PHONE_NUMBER_ID!==PHONE)
   return respond({error:'Homologation processing disabled'},503);
 const cutoff=process.env.CHATBOT_HOMOLOGATION_CUTOFF_AT;
 if(!cutoff || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(cutoff) ||
    !Number.isFinite(Date.parse(cutoff)) || Date.parse(cutoff)>Date.now())
   return respond({error:'Valid past UTC cutoff required'},503);
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key) return respond({error:'Database unavailable'},503);
 const rpc=async(name,body)=>{
   const res=await fetch(`${base}/rest/v1/rpc/${name}`,{
     method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
     body:JSON.stringify(body),cache:'no-store'});
   if(!res.ok)throw new Error(`${name}_${res.status}`);
   return res.json();
 };
 try{
   const claimed=await rpc('nexus_homologation_claim',{p_cutoff:cutoff,p_limit:20});
   let completed=0,skipped=0;
   for(const job of claimed){
     // Intentionally no Meta API, wallet, contract, or inbound event mutation.
     // Completion means only that the existing simulated audit was acknowledged.
     const ok=await rpc('nexus_homologation_complete',{p_job_id:job.job_id,p_token:job.claim_token});
     if(ok===true)completed++;else skipped++;
   }
   return respond({mode:'homologation_processing',scope:'root_phone_only',
     sending_enabled:false,credits_debited:false,contracts_consulted:false,
     wallets_consulted:false,webhook_events_modified:false,
     cutoff_utc:cutoff,claimed:claimed.length,completed,skipped,
     state_storage:'homologation_jobs_only'});
 }catch(e){console.error('homologation_processing_failed',e?.message||'unknown');
   return respond({error:'Homologation processing unavailable; check logs'},503);}
}
