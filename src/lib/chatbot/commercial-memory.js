import {isPortalEntry,aliases,planSummary} from './institutional-catalog.js';
import {profileTurn} from './commercial-profile.js';
import {portfolio,recommend,liveOffers,eligible,money,norm} from '../commercial/portfolio.js';
const families={...aliases,CHATBOT:/\b(chatbot|chat bot|chat boot|whatsapp)\b/};
const scope=j=>({organization_id:j.organization_id,phone_number_id:j.phone_number_id,contact_phone:j.contact_phone});
export async function commercialMemory({job,message,base,headers,fetchImpl=fetch}){
 const key=scope(job), url=new URL(base+'/rest/v1/nexus_chatbot_commercial_memory');
 for(const [k,v] of Object.entries(key))url.searchParams.set(k,'eq.'+v);
 url.searchParams.set('select','codes,revision,profile');url.searchParams.set('limit','2');
 const r=await fetchImpl(url.toString(),{headers,cache:'no-store'});if(!r.ok)throw Error('commercial_memory_read');
 const rows=await r.json();if(!Array.isArray(rows)||rows.length>1)throw Error('commercial_memory_invalid');
 const state=rows[0]||{codes:[],revision:0};
 const q=norm(message);
 const profile=profileTurn(message,state.profile);
 // Portal entries and explicit proposals must reach the catalog before any edit.
 if(isPortalEntry(q)||/\bproposta plenium\b/.test(q)||message.startsWith('pl:'))return {state,key};
 const reset=/^(nova proposta|limpar proposta|reiniciar proposta)$/.test(q);
 const show=/^(minha proposta|ver proposta|quanto ficou|qual o total|total da proposta|qual e a minha proposta atual|qual minha proposta|minha proposta atual|qual e a minha proposta|qual o valor total)$/.test(q);
 const edit=/\b(adicionar|adicione|incluir|inclua|acrescentar|contratar|quero|retirar|remover|excluir|trocar|substituir|mudar|upgrade)\b/.test(q)||/^e se eu quiser\b/.test(q);
 const remove=/\b(retirar|remover|excluir|sem)\b/.test(q)&&!/\bsem ia\b/.test(q);
 let family=Object.keys(families).filter(k=>families[k].test(q));if(family.includes('CHATBOT')&&!/\b(?:e|mais) (?:ia|inteligencia artificial)\b/.test(q))family=family.filter(k=>k!=='IA');
 const level=q.match(/\b(core|eco|integra|basico|standard|profissional)\b/)?.[1];
 if(!family.length&&level&&state.codes.length===1)family=[state.codes[0].split('_')[0]];
 if(!profile&&!reset&&!show&&!(edit&&family.length&&!/\b(?:nao quero|nao preciso|nao incluir|nao adicionar|nao contratar)\b/.test(q)&&(!/\d/.test(q)||level)))return {state,key};
 const response=(reply,codes)=>({type:'catalog',reply,options:[{id:'pl:home',title:'Menu principal'},{id:'pl:offers',title:'Consultar ofertas'}],...(codes?{proposalCodes:codes}:{})});
 if(reset)return {state,key,profile:{},result:response('*Nova proposta*\n\nComposição anterior limpa. Informe seu segmento e necessidades.',[])};
 const rr=await fetchImpl(base+'/rest/v1/nexus_products?select=code,monthly_price,active,standalone&active=eq.true&limit=501',{headers,cache:'no-store'});if(!rr.ok)throw Error('commercial_catalog_read');const data=await rr.json();if(!Array.isArray(data)||data.length>500)throw Error('commercial_catalog_invalid');const live=liveOffers(data);
 let items=state.codes.map(c=>live.find(o=>o.code===c));if(items.some(x=>!x))return {state,key,result:response('Sua composição contém ofertas indisponíveis. Digite nova proposta para recomeçar ou consulte nossa equipe.')};
 if(profile){
 const p=portfolio.find(x=>x.id===profile.family);const missing=Object.keys(p.limits).filter(k=>!profile.quantities[k]);
 if(missing.length)return {state,key,profile,result:response('*PLENIUM | '+p.name.toUpperCase()+'*\n\n'+(Object.keys(profile.quantities).length?'Já registrei: '+Object.entries(profile.quantities).map(([k,v])=>v+' '+k).join(', ')+'. ':'Podemos orientar sua escolha. '+live.filter(o=>o.family===p.id&&o.standalone).map(o=>planSummary(p,o)).join('\n\n')+'\n\n')+'Informe apenas: '+missing.join(', ')+'. Escopo sujeito à confirmação comercial.',state.codes)};
 const i=recommend(p,profile.quantities,profile.needs);const offer=live.find(o=>o.family===p.id&&o.index===i&&o.standalone);const extras=profile.extras.map(c=>live.find(o=>o.code===c));
 if(!offer||extras.some(o=>!o))return {state,key,profile,result:response('Seu perfil precisa de confirmação comercial.',state.codes)};
 const additions=[offer,...extras];items=[...items.filter(o=>!additions.some(a=>a.family===o.family)),...additions];
 }else if(!show){
 const clauses=q.split(/\b(?:e|mais)\b/).filter(x=>Object.keys(families).some(k=>families[k].test(x)));
 const edits=family.length>1?clauses:[q];
 const seen=new Set();
 for(const clause of edits){let fs=family.filter(k=>families[k].test(clause));if(fs.includes('CHATBOT'))fs=fs.filter(k=>k!=='IA');if(fs.length!==1||seen.has(fs[0]))return {state,key,result:response('Informe cada produto e seu plano separadamente.')};const f=fs[0];seen.add(f);
 if(remove){items=items.filter(o=>o.family!==f);continue;}
 const wanted=clause.match(/\b(core|eco|integra|basico|standard|profissional)\b/)?.[1]||(f==='CHATBOT'&&/\b(com ia|inteligencia artificial)\b/.test(clause)?'standard':null);const existing=items.find(o=>o.family===f);const offer=live.find(o=>o.family===f&&o.standalone&&(wanted?norm(o.level)===wanted:existing?o.code===existing.code:o.index===0));if(!offer)return {state,key,result:response('Não encontrei esse plano vigente. Informe o produto e o plano desejado.')};items=[...items.filter(o=>o.family!==f),offer];}
 if(seen.size!==family.length)return {state,key,result:response('Não consegui identificar todos os produtos solicitados.')};
 }
 if(items.some(o=>!eligible(o,items)))return {state,key,result:response('A alteração deixaria um produto agregado sem seu requisito. Consulte nossa equipe antes de alterar.')};
 return {state,key,profile,result:response('*SUA PROPOSTA PLENIUM*\n\n'+(items.length?items.map(o=>'✓ '+o.name+' — '+money(o.price)+'/mês'+(profile&&o.family===profile.family?'\n'+planSummary(portfolio.find(p=>p.id===o.family),o):'')).join('\n'):'Nenhum produto selecionado.')+'\n\n*Investimento mensal: '+money(items.reduce((s,o)=>s+o.price,0))+'*\n\nConsulte nossas ofertas e condições comerciais especiais. Escopo sujeito à confirmação comercial.',show?undefined:items.map(o=>o.code))};
}
export async function saveCommercialMemory({job,context,base,headers,fetchImpl=fetch}){
 const r=await fetchImpl(base+'/rest/v1/rpc/nexus_save_commercial_profile',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_job_id:job.id,p_revision:context.revision,p_codes:context.codes,p_profile:context.profile??null})});return r.ok&&(await r.json())===true;
}
