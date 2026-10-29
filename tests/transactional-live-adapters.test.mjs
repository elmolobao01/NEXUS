import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransactionalLiveAdapters } from '../src/lib/chatbot/transactional-live-adapters.js';
const opts={supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',metaAccessToken:'test',allowedPhoneNumberIds:['1295394797000036']};
test('no authorization cannot construct transport',()=>{
 let calls=0;
 assert.throws(()=>createTransactionalLiveAdapters({...opts,fetchImpl:async()=>{calls++;},authorization:{approved:true}}),/explicit_pilot_authorization_required/);
 assert.equal(calls,0);
});
test('explicit authorization creates but does not run transport',()=>{
 let calls=0;
 const adapters=createTransactionalLiveAdapters({...opts,fetchImpl:async()=>{calls++;},authorization:{approved:true,pilot:true,financial_mutations:true,meta_sends:true}});
 assert.equal(typeof adapters.runPilotBatch,'function');assert.equal(calls,0);
});
test('pilot disallows batches greater than one without RPC',async()=>{
 let calls=0;
 const adapters=createTransactionalLiveAdapters({...opts,fetchImpl:async()=>{calls++;},authorization:{approved:true,pilot:true,financial_mutations:true,meta_sends:true}});
 await assert.rejects(()=>adapters.runPilotBatch({limit:2}),/pilot_limit_must_be_one/);
 assert.equal(calls,0);
});
