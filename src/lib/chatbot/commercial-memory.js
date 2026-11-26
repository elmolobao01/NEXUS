import {liveOffers,eligible,money,norm} from '../commercial/portfolio.js';
const families={CHATBOT:/\b(chatbot|chat bot|chat boot|whatsapp)\b/,WEBSITE:/\b(site|website)\b/,GESTAO:/\bgestao\b/,IA:/\b(inteligencia artificial|inteligencia e ia|ia)\b/};
const scope=j=>({organization_id:j.organization_id,phone_number_id:j.phone_number_id,contact_phone:j.contact_phone});
export async function commercialMemory({job,message,base,headers,fetchImpl=fetch}){
 const key=scope(job), url=new URL(base+'/rest/v1/nexus_chatbot_commercial_memory');
 for(const [k,v] of Object.entries(key))url.searchParams.set(k,'eq.'+v);
 url.searchParams.set('select','codes,revision');url.searchParams.set('limit','2');
 const r=await fetchImpl(url.toString(),{headers,cache:'no-store'});if(!r.ok)throw Error('commercial_memory_read');
 const rows=await r.json();if(!Array.isArray(rows)||rows.length>1)throw Error('commercial_memory_invalid');
 const state=rows[0]||{codes:[],revision:0};
 const q=norm(message);const reset=/^(nova proposta|limpar proposta|reiniciar proposta)$/.test(q);
 const show=/^(minha proposta|ver proposta|quanto ficou|qual o total|total da proposta)$/.test(q);
 const edit=/\b(adicionar|adicione|incluir|inclua|quero|retirar|remover|excluir|trocar|substituir|mudar|upgrade)\b/.test(q)||/^e se eu quiser\b/.test(q);
 const remove=/\b(retirar|remover|excluir|sem)\b/.test(q)&&!/\bsem ia\b/.test(q);
 let family=Object.keys(families).filter(k=>families[k].test(q));if(family.includes('CHATBOT'))family=family.filter(k=>k!=='IA');
 const level=q.match(/\b(core|eco|integra|basico|standard|profissional)\b/)?.[1];
 if(!family.length&&level&&state.codes.length===1)family=[state.codes[0].split('_')[0]];
 if(!reset&&!show&&!(edit&&state.codes.length&&family.length))return {state,key};
 const response=(reply,codes)=>({type:'catalog',reply,options:[{id:'pl:home',title:'Menu principal'},{id:'pl:offers',title:'Consultar ofertas'}],...(codes?{proposalCodes:codes}:{})});
 if(reset)return {state,key,result:response('*Nova proposta*\n\nComposição anterior limpa. Informe seu segmento e necessidades.',[])};
 const rr=await fetchImpl(base+'/rest/v1/nexus_products?select=code,monthly_price,active,standalone&active=eq.true&limit=501',{headers,cache:'no-store'});if(!rr.ok)throw Error('commercial_catalog_read');const data=await rr.json();if(!Array.isArray(data)||data.length>500)throw Error('commercial_catalog_invalid');const live=liveOffers(data);
 let items=state.codes.map(c=>live.find(o=>o.code===c));if(items.some(x=>!x))return {state,key,result:response('Sua composição contém ofertas indisponíveis. Digite nova proposta para recomeçar ou consulte nossa equipe.')};
 if(!show){if(family.length!==1)return {state,key,result:response('Para atualizar com segurança, informe um produto por mensagem.')};const f=family[0];if(remove){items=items.filter(o=>o.family!==f);}else{const wanted=level||(f==='CHATBOT'&&/\b(com ia|inteligencia artificial)\b/.test(q)?'standard':null);const existing=items.find(o=>o.family===f);const offer=live.find(o=>o.family===f&&o.standalone&&(wanted?norm(o.level)===wanted:existing?o.code===existing.code:o.index===0));if(!offer)return {state,key,result:response('Não encontrei esse plano vigente. Informe o produto e o plano desejado.')};items=[...items.filter(o=>o.family!==f),offer];}}
 if(items.some(o=>!eligible(o,items)))return {state,key,result:response('A alteração deixaria um produto agregado sem seu requisito. Consulte nossa equipe antes de alterar.')};
 return {state,key,result:response('*SUA PROPOSTA PLENIUM*\n\n'+(items.length?items.map(o=>'✓ '+o.name+' — '+money(o.price)+'/mês').join('\n'):'Nenhum produto selecionado.')+'\n\n*Investimento mensal: '+money(items.reduce((s,o)=>s+o.price,0))+'*\n\nConsulte nossas ofertas e condições comerciais especiais. Escopo sujeito à confirmação comercial.',show?undefined:items.map(o=>o.code))};
}
export async function saveCommercialMemory({job,context,base,headers,fetchImpl=fetch}){
 const r=await fetchImpl(base+'/rest/v1/rpc/nexus_save_commercial_memory',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_job_id:job.id,p_revision:context.revision,p_codes:context.codes})});return r.ok&&(await r.json())===true;
}
