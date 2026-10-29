import test from 'node:test';
import assert from 'node:assert/strict';
import { executeClaimedJob } from '../src/lib/chatbot/transactional-executor.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const job = { id:id(1), organization_id:id(2), message_id:'wamid.test',
  phone_number_id:'1295394797000036' };
function mock(selection) {
  const calls=[];
  const adapters={
    claim: async()=>({acquired:true,token:id(3)}),
    revalidate: async()=>({allow:true}),
    selectReply: async()=>selection,
    humanPause: async()=>({allow:true}),
    reserve: async()=>{calls.push('reserve');return {allowed:true,status:'reserved',operation_id:id(4)}},
    send: async(_job,payload)=>{calls.push(['send',payload.selected_reply,payload.response_engine]);return {outcome:'accepted',meta_message_id:'wamid.sent'}},
    finalize: async()=>calls.push('finalize'),
    finish: async()=>calls.push('finish')
  };
  return {calls,adapters};
}
test('Básico envia resposta selecionada no payload',async()=>{
 const {calls,adapters}=mock({allow:true,engine:'rules',reply:'Olá'});
 const result=await executeClaimedJob(job,adapters);
 assert.equal(result.state,'completed');
 assert.deepEqual(calls[1],['send','Olá','rules']);
});
test('Standard envia resposta selecionada no payload',async()=>{
 const {calls,adapters}=mock({allow:true,engine:'ai',reply:'Resposta IA'});
 const result=await executeClaimedJob(job,adapters);
 assert.equal(result.state,'completed');
 assert.deepEqual(calls[1],['send','Resposta IA','ai']);
});
test('seleção sem quota impede reserva e envio',async()=>{
 const {calls,adapters}=mock({allow:false,reason:'ai_quota_reservation_required'});
 const result=await executeClaimedJob(job,adapters);
 assert.equal(result.state,'blocked');
 assert.deepEqual(calls,['finish']);
});
test('resposta vazia impede reserva e envio',async()=>{
 const {calls,adapters}=mock({allow:true,engine:'ai',reply:''});
 const result=await executeClaimedJob(job,adapters);
 assert.equal(result.state,'blocked');
 assert.deepEqual(calls,['finish']);
});
test('retrocompatibilidade sem seletor',async()=>{
 const {calls,adapters}=mock(null);delete adapters.selectReply;
 const result=await executeClaimedJob(job,adapters);
 assert.equal(result.state,'completed');
 assert.equal(calls[0],'reserve');
});
