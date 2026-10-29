import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransactionalLiveAdapters } from '../src/lib/chatbot/transactional-live-adapters.js';
const org='00000000-0000-4000-8000-000000000001', phone='1295394797000036';
const authorization={approved:true,pilot:true,financial_mutations:true,meta_sends:true};
const cfg={authorization,supabaseUrl:'https://example.supabase.co',serviceRoleKey:'fake',metaAccessToken:'fake',organizationId:org,phoneNumberId:phone,allowedPhoneNumberIds:[phone]};
test('no tenant: adapter refuses construction',()=>assert.throws(()=>createTransactionalLiveAdapters({...cfg,organizationId:undefined}),/configuration_invalid/));
test('phone mismatch: adapter refuses construction',()=>assert.throws(()=>createTransactionalLiveAdapters({...cfg,phoneNumberId:'1234567'}),/configuration_invalid/));
test('one-message pilot claims via scoped RPC only',async()=>{
 const calls=[];
 const adapter=createTransactionalLiveAdapters({...cfg,fetchImpl:async(url,options)=>{
   calls.push({url,body:JSON.parse(options.body)});
   return {ok:true,json:async()=>[]};
 }});
 const result=await adapter.runPilotBatch({limit:1});
 assert.equal(result.claimed,0);
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/nexus_chatbot_inbound_claim_scoped$/);
 assert.deepEqual(calls[0].body,{p_organization_id:org,p_phone_number_id:phone,p_limit:1});
});
test('pilot refuses batches larger than one without RPC',async()=>{
 let calls=0;
 const adapter=createTransactionalLiveAdapters({...cfg,fetchImpl:async()=>{calls++;throw Error('unexpected')}});
 await assert.rejects(()=>adapter.runPilotBatch({limit:2}),/pilot_limit/);
 assert.equal(calls,0);
});
