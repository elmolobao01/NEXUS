import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransactionalProductionReader } from '../src/lib/chatbot/transactional-production-adapters.js';
import { executeClaimedJob } from '../src/lib/chatbot/transactional-executor.js';
const U='00000000-0000-4000-8000-000000000001', V='00000000-0000-4000-8000-000000000002', E='00000000-0000-4000-8000-000000000003';
const job={id:U,organization_id:V,source_event_id:E,phone_number_id:'1295394797000036',contact_phone:'5571999992478',message_id:'wamid.in'};
function readerFor(plan,text,scope=job,pauseCheck=async()=>({allow:true})){
 const job=scope;
 const calls=[];
 const event={id:E,organization_id:job.organization_id,phone_number_id:job.phone_number_id,event_payload:{entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:job.phone_number_id},messages:[{id:job.message_id,from:job.contact_phone,type:'text',text:{body:text}}]}}]}]}};
 const rows={nexus_whatsapp_webhook_events:[event],nexus_meta_whatsapp_connections:[{connection_status:'active',credential_reference:'ref'}],nexus_chatbot_configs:[{active:true,welcome_message:'Bem-vindo',faq:[]}],nexus_chatbot_message_wallets:[{plan_code:plan,cycle_start:'2020-01-01',cycle_end:'2099-01-01',included_remaining:100}],nexus_chatbot_outbound_operations:[]};
 const fetchImpl=async(url,options)=>{calls.push([url,options.method]);return {ok:true,json:async()=>url.includes('/rpc/')?true:(rows[url.split('/rest/v1/')[1].split('?')[0]]??[])}};
 const reader=createTransactionalProductionReader({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl,pauseCheck});
 return {reader,calls};
}
test('Básico seleciona resposta sem chamadas de escrita',async()=>{
 const {reader,calls}=readerFor('CHATBOT_BASIC','oi');
 const result=await reader.revalidate(job);
 assert.equal(result.allow,true);assert.equal(result.reply,'Bem-vindo');assert.equal(result.response_engine,'rules');
 assert.equal((await reader.selectReply(job,result)).reply,'Bem-vindo');
 assert.equal(calls.filter(c=>c[1]!=='GET'&&!c[0].includes('/rpc/nexus_chatbot_has_active_contract')).length,0);
});
test('Standard prioriza regra e bloqueia IA sem quota',async()=>{
 const {reader}=readerFor('CHATBOT_AI','oi');
 assert.equal((await reader.revalidate(job)).response_engine,'rules');
 const {reader:unknown}=readerFor('CHATBOT_AI','pergunta sem regra');
 assert.equal((await unknown.revalidate(job)).reason,'ai_not_authorized_or_budget_exhausted');
});
test('executor impede reserva se seletor falhar',async()=>{
 let reserved=false;let finished=false;
 const adapters={claim:async()=>({acquired:true,token:E}),revalidate:async()=>({allow:true}),selectReply:async()=>({allow:false,reason:'blocked'}),humanPause:async()=>({allow:true}),reserve:async()=>{reserved=true},send:async()=>{},finalize:async()=>{},finish:async()=>{finished=true}};
 const result=await executeClaimedJob(job,adapters);
 assert.equal(result.state,'blocked');assert.equal(reserved,false);assert.equal(finished,true);
});

const official={...job,organization_id:'11de735a-4dfb-4b8d-b817-bda83d6df03a',phone_number_id:'1453993444467017'};
test('PLENIUM oficial: fallback local sem Gemini ou escrita',async()=>{
 const {reader,calls}=readerFor('CHATBOT_AI','pergunta sem regra',official);
 const r=await reader.revalidate(official);
 assert.equal(r.allow,true);assert.equal(r.response_type,'institutional_fallback');assert.equal(r.response_engine,'rules');
 assert.ok(calls.every(([url])=>url.startsWith('https://example.supabase.co/')));
 assert.ok(calls.every(([url,method])=>method==='GET'||url.includes('/rpc/nexus_chatbot_has_active_contract')));
});
test('PLENIUM: outro número não recebe fallback institucional',async()=>{
 const other={...official,phone_number_id:job.phone_number_id};
 const {reader}=readerFor('CHATBOT_AI','pergunta sem regra',other);
 assert.equal((await reader.revalidate(other)).allow,false);
});
test('PLENIUM: pausa humana bloqueia fallback',async()=>{
 const {reader}=readerFor('CHATBOT_AI','pergunta sem regra',official,async()=>({allow:false,reason:'human_pause_active'}));
 assert.equal((await reader.revalidate(official)).reason,'human_pause_active');
});
