import test from 'node:test';import assert from 'node:assert/strict';
import {commercialMemory} from '../src/lib/chatbot/commercial-memory.js';
import {offers} from '../src/lib/commercial/portfolio.js';
let state={codes:[],revision:0,profile:{}};
const fetchImpl=async url=>({ok:true,json:async()=>url.includes('nexus_products')?offers.map(o=>({code:o.code,monthly_price:o.price,active:true,standalone:o.standalone})):[state]});
async function turn(message){const r=await commercialMemory({job:{organization_id:'a',phone_number_id:'b',contact_phone:'c'},message,base:'https://example.com',headers:{},fetchImpl});if(r.result?.proposalCodes)state={codes:r.result.proposalCodes,revision:state.revision+1,profile:r.profile??state.profile};return r.result;}
test('partial profile and multiple additions',async()=>{assert.match((await turn('Tenho uma pousada com 8 quartos')).reply,/unidades, usuarios/);await turn('1 unidade e 2 usuarios');assert.deepEqual(state.codes,['HOTELARIA_CORE']);await turn('Quero adicionar Chatbot Básico e Gestão CORE');assert.deepEqual(state.codes,['HOTELARIA_CORE','CHATBOT_BASIC','GESTAO_CORE']);await turn('Quero trocar para Chatbot Standard');assert.ok(state.codes.includes('CHATBOT_AI'));assert.match((await turn('Quanto ficou?')).reply,/309,70/);await turn('nova proposta');assert.deepEqual(state.profile,{});});
