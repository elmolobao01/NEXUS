import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
const respond=(data,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request){
 try {
  const token=request.cookies.get("nexus_access_token")?.value;
  if(!url||!pub||!service||!token) return respond({error:"Unauthorized"},401);
  const userRes=await fetch(`${url}/auth/v1/user`,{headers:{apikey:pub,Authorization:`Bearer ${token}`},cache:"no-store"});
  if(!userRes.ok) return respond({error:"Unauthorized"},401);
  const user=await userRes.json(); if(!user?.id) return respond({error:"Unauthorized"},401);
  const profileRes=await fetch(`${url}/rest/v1/nexus_user_profiles?select=profile,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`,{headers:{apikey:pub,Authorization:`Bearer ${token}`},cache:"no-store"});
  if(!profileRes.ok) return respond({error:"Forbidden"},403);
  const profiles=await profileRes.json();
  if(!["NEXUS_ROOT","NEXUS_ADMIN"].includes(profiles?.[0]?.profile)) return respond({error:"Forbidden"},403);
  const headers={apikey:service,Authorization:`Bearer ${service}`};
  const [wallets,events]=await Promise.all([
   fetch(`${url}/rest/v1/nexus_chatbot_message_wallets?select=organization_id,plan_code,monthly_allowance,cycle_start,cycle_end,included_remaining,prepaid_remaining,updated_at&order=updated_at.desc&limit=500`,{headers,cache:"no-store"}),
   fetch(`${url}/rest/v1/nexus_whatsapp_webhook_events?select=organization_id,processing_status,received_at&order=received_at.desc&limit=1000`,{headers,cache:"no-store"})
  ]);
  if(!wallets.ok||!events.ok) return respond({error:"Wallet migration missing or query failed"},503);
  const ws=await wallets.json(), es=await events.json();
  const received=new Map();for(const e of es){received.set(e.organization_id,(received.get(e.organization_id)||0)+1);}
  return respond({wallets:ws.map(w=>({...w,received_events_sample:received.get(w.organization_id)||0})),sample_limit:1000,estimated_cost_note:"Eventos recebidos não são mensagens faturadas; custos Meta exigem classificação e tarifas vigentes."});
 }catch{return respond({error:"Temporary failure"},503);}
}
