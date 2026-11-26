import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticDispatchAllowed, dispatchInstitutionalJobs } from '../src/lib/chatbot/institutional-auto-dispatch.js';
import { institutionalCatalogReply, INSTITUTIONAL_ORG } from '../src/lib/chatbot/institutional-catalog.js';
const phone='1453993444467017';
const env={CHATBOT_INSTITUTIONAL_AUTO_ENABLED:'true',CHATBOT_PILOT_EXECUTION_ENABLED:'true',CHATBOT_PILOT_FINANCIAL_MUTATIONS_APPROVED:'true',CHATBOT_PILOT_META_SENDS_APPROVED:'true',CHATBOT_PILOT_ORGANIZATION_ID:INSTITUTIONAL_ORG,CHATBOT_PILOT_PHONE_NUMBER_ID:phone,CHATBOT_INBOUND_QUEUE_ADMISSION_ENABLED:'true',CHATBOT_INBOUND_ADMISSION_ALLOWED_PHONE_IDS:phone};
const records=[{organization_id:INSTITUTIONAL_ORG,phone_number_id:phone}];
test('automatic execution requires all approvals and institutional scope',()=>{
 assert.equal(automaticDispatchAllowed(env,records,1),true);
 for(const key of Object.keys(env)) assert.ok(!automaticDispatchAllowed({...env,[key]:undefined},records,1),key);
 assert.ok(!automaticDispatchAllowed(env,records,0));
 assert.ok(!automaticDispatchAllowed(env,[...records,{organization_id:'other',phone_number_id:phone}],1));
});
test('dispatch is bounded and stops on uncertainty',async()=>{
 let calls=0; const log=()=>{};
 const accepted={status:200,body:{claimed:1,results:[{state:'completed',outcome:'accepted'}]}};
 await dispatchInstitutionalJobs({inserted:25,log,run:async()=>{calls++;return accepted;}});
 assert.equal(calls,3);
 calls=0;
 await dispatchInstitutionalJobs({inserted:3,log,run:async()=>{calls++;return {status:200,body:{claimed:1,results:[{state:'blocked',outcome:'uncertain'}]}};}});
 assert.equal(calls,1);
});
test('dispatch stops on empty queue, error or elapsed budget',async()=>{
 for(const result of [{status:503,body:{}},{status:200,body:{claimed:0,results:[]}}]){
 let calls=0;await dispatchInstitutionalJobs({inserted:3,log:()=>{},run:async()=>{calls++;return result;}});assert.equal(calls,1);
 }
 let calls=0,t=0;await dispatchInstitutionalJobs({inserted:3,log:()=>{},now:()=>{t+=36000;return t;},run:async()=>{calls++;}});assert.equal(calls,0);
});
test('standalone product selection retrieves current catalog; no other tenant access',async()=>{
 let calls=0;const args={organizationId:INSTITUTIONAL_ORG,planCode:'CHATBOT_AI',config:{active:true},message:'Hotelaria',base:'https://example.com',headers:{},fetchImpl:async()=>{calls++;return {ok:true,json:async()=>[{name:'Hotelaria CORE',segment:'Hotelaria',active:true,standalone:true,monthly_price:89.9}]};}};
 const result=await institutionalCatalogReply(args);assert.equal(result.type,'catalog');assert.match(result.reply,/89,90/);
 assert.equal(await institutionalCatalogReply({...args,organizationId:'other'}),null);assert.equal(calls,1);
});
