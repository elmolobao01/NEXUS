import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopedClaimBatch } from '../src/lib/chatbot/scoped-claim-adapter.js';
const org='00000000-0000-4000-8000-000000000001';
test('rejects missing tenant',()=>assert.throws(()=>createScopedClaimBatch({rpc:async()=>[],phoneNumberId:'1295394797000036'})));
test('passes exact tenant and phone to scoped RPC',async()=>{
 let call;
 const batch=createScopedClaimBatch({organizationId:org,phoneNumberId:'1295394797000036',rpc:async(...args)=>{call=args;return []}});
 assert.deepEqual(await batch(1),[]);
 assert.deepEqual(call,['nexus_chatbot_inbound_claim_scoped',{p_organization_id:org,p_phone_number_id:'1295394797000036',p_limit:1}]);
});
test('rejects cross-tenant claim rows',async()=>{
 const batch=createScopedClaimBatch({organizationId:org,phoneNumberId:'1295394797000036',rpc:async()=>[{organization_id:'00000000-0000-4000-8000-000000000002'}]});
 await assert.rejects(()=>batch(1),/tenant_mismatch/);
});
test('rejects invalid limits without invoking RPC',async()=>{
 let calls=0;
 const batch=createScopedClaimBatch({organizationId:org,phoneNumberId:'1295394797000036',rpc:async()=>{calls++;return []}});
 await assert.rejects(()=>batch(21),/invalid_scoped_claim_limit/);
 assert.equal(calls,0);
});
