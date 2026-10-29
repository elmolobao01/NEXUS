import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectChatbotReply } from '../src/lib/chatbot/plan-response-router.js';
const config = {active:true, welcome_message:'Bem-vindo', faq:[{question:'horário',answer:'Das 8 às 18'}]};
test('Básico responde sem IA', async () => {
  const r=await selectChatbotReply({planCode:'CHATBOT_BASIC',config,message:'oi'});
  assert.equal(r.reply,'Bem-vindo');assert.equal(r.engine,'rules');
});
test('Standard usa regras antes da IA', async () => {
  const r=await selectChatbotReply({planCode:'CHATBOT_AI',config,message:'oi',aiProvider:()=>{throw Error('never')}});
  assert.equal(r.engine,'rules');
});
test('Standard não usa IA sem franquia definida', async () => {
  const r=await selectChatbotReply({planCode:'CHATBOT_AI',config,message:'pergunta desconhecida',aiProvider:async()=>({reply:'IA'})});
  assert.equal(r.allow,false);
});
test('Standard exige reserva de quota de IA', async () => {
  const r=await selectChatbotReply({planCode:'CHATBOT_AI',config,message:'pergunta desconhecida',aiProvider:async()=>({reply:'IA'}),aiPolicy:{max_requests_per_cycle:100},aiUsage:{requests_this_cycle:0}});
  assert.equal(r.reason,'ai_quota_reservation_required');
});
test('Standard usa IA com reserva injetada', async () => {
  const r=await selectChatbotReply({planCode:'CHATBOT_AI',config,message:'pergunta desconhecida',aiProvider:async()=>({reply:'Resposta de teste'}),aiPolicy:{max_requests_per_cycle:100,quota_reserved:true,reservation_id:'test'},aiUsage:{requests_this_cycle:0}});
  assert.equal(r.reply,'Resposta de teste');assert.equal(r.engine,'ai');
});
test('plano desconhecido bloqueado', async () => {
  assert.equal((await selectChatbotReply({planCode:'OTHER',config,message:'oi'})).allow,false);
});
