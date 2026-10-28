import test from 'node:test';
import assert from 'node:assert/strict';
import { assessReadOnlyTransaction } from '../src/lib/chatbot/transactional-readiness-assessment.js';
const id='11111111-1111-4111-8111-111111111111';
const org='22222222-2222-4222-8222-222222222222';
const source='33333333-3333-4333-8333-333333333333';
const job={id,organization_id:org,source_event_id:source,phone_number_id:'123456789',contact_phone:'5511999999999',message_id:'wamid.123',state:'pending'};
const event={id:source,organization_id:org,phone_number_id:job.phone_number_id,event_payload:{entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:job.phone_number_id},messages:[{id:job.message_id,from:job.contact_phone,type:'text',text:{body:'Oi'}}]}}]}]}};
const connection={organization_id:org,phone_number_id:job.phone_number_id,connection_status:'active',credential_reference:'ref'};
const wallet={plan_code:'CHATBOT_BASIC',cycle_start:'2026-10-01',cycle_end:'2026-11-01',included_remaining:10,prepaid_remaining:0};
const baseline={job,event,connection,config:{active:true},wallet,pause:null,operation:null,contractActive:true,now:'2026-10-28T12:00:00.000Z'};
const cases=[
 ['candidate',{},'read_only_candidate'],
 ['duplicate operation',{operation:{id}},'outbound_operation_already_exists'],
 ['inactive contract',{contractActive:false},'contract_inactive'],
 ['wallet empty',{wallet:{...wallet,included_remaining:0}},'wallet_cycle_or_balance_invalid'],
 ['human pause',{pause:{pause_until:'2026-10-28T13:00:00.000Z'}},'human_pause_active'],
 ['wrong tenant',{connection:{...connection,organization_id:id}},'connection_unavailable'],
 ['wrong event',{event:{...event,organization_id:id}},'source_event_mismatch'],
 ['job processing',{job:{...job,state:'processing'}},'job_not_pending'],
 ['ambiguous message',{event:{...event,event_payload:{entry:[...event.event_payload.entry,...event.event_payload.entry]}}},'source_message_not_unique'],
 ['expired pause',{pause:{pause_until:'2026-10-28T11:00:00.000Z'}},'read_only_candidate'],
];
for(const [name,changes,reason] of cases) test(name,()=>{
 const result=assessReadOnlyTransaction({...baseline,...changes});
 assert.equal(result.reason,reason);
 assert.equal(result.automatic_execution_authorized,false);
});
