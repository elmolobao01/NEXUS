import {isPortalEntry,aliases,planSummary} from './institutional-catalog.js';
import {profileTurn} from './commercial-profile.js';
import {portfolio,recommend,liveOffers,eligible,money,norm} from '../commercial/portfolio.js';
const names={unidades:'estabelecimentos',quartos:'quartos',usuarios:'pessoas que usarão o sistema',profissionais:'profissionais',alunos:'alunos',contratos:'contratos',pdvs:'PDVs',pets:'pets'};
const webUses={HOTELARIA:'Website com reservas online',SAUDE:'Website com agendamento de consultas',RESTAURANTE:'Website com cardápio e pedidos online',EDUCACAO:'Website com pré-matrícula',VAREJO:'Website com loja virtual',IMOBILIARIO:'Website com catálogo de imóveis',PET:'Website com agendamento',PROFISSAO:'Website com portfólio e agendamento'};
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
 let profile=profileTurn(message,state.profile);
 if(/^(?:ola )?(?:gostaria de|quero) conhecer (?:as |os )?(?:solucoes|produtos)(?: da plenium)?$/.test(q))return {state,key};
 // Portal entries and explicit proposals must reach the catalog before any edit.
 if(isPortalEntry(q)||/\bproposta plenium\b/.test(q)||message.startsWith('pl:'))return {state,key};
 const simulation=/\b(simular|simulacao|quanto ficaria|quanto custaria|quanto sairia|qual seria|e se|se eu|beneficios de|vale a pena)\b/.test(q);
 const inquiry=!simulation&&/^(?:quais|qual|quanto|como|o que|me explique|gostaria de saber|quero saber)\b/.test(q);
 const objection=/\b(?:caro|cara|elevado|elevada|muito alto|muito alta|reduzir (?:os |meus )?custos|melhorar (?:meu |o )?faturamento|aumentar (?:meu |o )?faturamento|vantagens de contratar|vale a pena)\b/.test(q)&&! /^(?:adicione|inclua|remova|retire|quero adicionar|quero remover)\b/.test(q);
 const reset=/^(nova proposta|limpar proposta|reiniciar proposta)$/.test(q);
 const integrated=/\b(?:valor promocional|valores promocionais|preco integrado|aplicar promocao|configurar ecossistema)\b/.test(q);
 const show=/^(minha proposta|ver proposta|quanto ficou|qual o total|total da proposta|qual e a minha proposta atual|qual minha proposta|minha proposta atual|qual e a minha proposta|qual o valor total)$/.test(q);
 const edit=/\b(adicionar|adicione|incluir|inclua|acrescentar|contratar|quero|retirar|remover|excluir|trocar|substituir|mudar|upgrade)\b/.test(q)||/^e se eu quiser\b/.test(q);
 const remove=/\b(retirar|remover|excluir|sem)\b/.test(q)&&!/\bsem ia\b/.test(q);
 const productText=norm(message.replace(/,/g,' e ')).replace(/\b(?:chatbot|chat bot|chat boot) (?:standard |basico )?(?:com (?:inteligencia artificial|ia)|sem ia)\b/g,m=>m.includes('sem ia')?'chatbot basico':'chatbot standard');
 const explicitEdit=edit&&/\b(adicionar|adicione|incluir|inclua|acrescentar|retirar|remover|excluir|trocar|substituir|mudar|upgrade)\b/.test(q);
 let family=Object.keys(families).filter(k=>families[k].test(productText));
 if(simulation||inquiry)profile=null;
 if(explicitEdit){profile=null;family=family.filter(k=>k!==state.profile?.family||new RegExp('(?:adicionar|incluir|remover|retirar|trocar|contratar) (?:o |a )?'+k.toLowerCase()+'\\b').test(productText));}
 const level=q.match(/\b(core|eco|integra|basico|standard|profissional)\b/)?.[1];
 if(!family.length&&level&&state.codes.length===1)family=[state.codes[0].split('_')[0]];
 if(/\b(suporte|reclamacao|cancelar|atendente|humano)\b/.test(q))return {state,key};
 if(!objection&&!profile&&!reset&&!show&&!integrated&&!simulation&&!inquiry&&!(edit&&family.length&&!/\b(?:nao quero|nao preciso|nao incluir|nao adicionar|nao contratar)\b/.test(q)&&(!/\d/.test(q)||level)))return {state,key};
 const response=(reply,codes)=>({type:'catalog',reply,options:[{id:'pl:home',title:'Menu principal'},{id:'pl:offers',title:'Consultar ofertas'}],...(codes?{proposalCodes:codes}:{})});
 if(/\b(nao quero|nao preciso|nao incluir|nao adicionar|nao contratar)\b/.test(q))return {state,key,result:response('Tudo bem. Mantive sua proposta sem alterações.',state.codes)};
 if(/\b(retirar|remover|excluir)\b/.test(q)&&/\b(adicionar|incluir|acrescentar)\b/.test(q))return {state,key,result:response('Para evitar alterações incorretas, informe primeiro os produtos a retirar e depois os que deseja adicionar.')};
 if(reset)return {state,key,profile:{},result:response('*Nova proposta*\n\nComposição anterior limpa. Informe seu segmento e necessidades.',[])};
 const rr=await fetchImpl(base+'/rest/v1/nexus_products?select=code,monthly_price,active,standalone&active=eq.true&limit=501',{headers,cache:'no-store'});if(!rr.ok)throw Error('commercial_catalog_read');const data=await rr.json();if(!Array.isArray(data)||data.length>500)throw Error('commercial_catalog_invalid');const live=liveOffers(data);
 let items=state.codes.map(c=>live.find(o=>o.code===c));if(items.some(x=>!x))return {state,key,result:response('Sua composição contém ofertas indisponíveis. Digite nova proposta para recomeçar ou consulte nossa equipe.')};
 const originalTotal=items.reduce((sum,o)=>sum+o.price,0);
 if(objection&&items.length){
 const primary=items.find(o=>o.family===state.profile?.family)||items.find(o=>!['GESTAO','IA','CHATBOT','WEBSITE'].includes(o.family));
 const benefits=items.map(o=>{const p=portfolio.find(x=>x.id===o.family);const features=p.features.slice(0,(o.index??0)+1).flat();return '• '+o.name+': '+features.slice(0,5).join(', ')+'.';}).join('\n');
 const comparison=primary?'\nApenas '+primary.name+': '+money(primary.price)+'/mês. O conjunto custa '+money(originalTotal)+'/mês, diferença de '+money(originalTotal-primary.price)+'/mês.':'';
 const reply='Entendo sua preocupação com o investimento. Cada solução deve contribuir para sua operação.\n\n'+benefits+'\n\n'+comparison+'\nEsses recursos podem apoiar a produtividade, o controle de despesas e o atendimento, mas os resultados financeiros dependem da utilização e da realidade do negócio. Podemos priorizar as soluções essenciais sem alterar sua proposta agora.'+(state.profile?.pendingWebsite?' O Website solicitado continua pendente de orçamento.':'')+'\n\nQual sua prioridade: reduzir custos, melhorar o atendimento ou ampliar as vendas?\n\nSeja Plenium. Um ecossistema inteiro para o seu negócio.\nwww.pleniumgestao.com.br';
 return {state,key,result:{...response(reply),commercialIntent:'objection'}};
 }
 if(inquiry&&!integrated&&!show&&family.length){
 const details=family.map(f=>{const p=portfolio.find(x=>x.id===f);return live.filter(o=>o.family===f&&o.standalone).map(o=>planSummary(p,o)).join('\n\n');}).join('\n\n');
 return {state,key,result:response(details+'\n\nSua proposta permanece sem alterações.')};
 }
 if(profile){
 const p=portfolio.find(x=>x.id===profile.family);const missing=Object.keys(p.limits).filter(k=>!profile.quantities[k]);
 if(missing.length)return {state,key,profile,result:response('*PLENIUM | '+p.name.toUpperCase()+'*\n\n'+(Object.keys(profile.quantities).length?'Já registrei: '+Object.entries(profile.quantities).map(([k,v])=>v+' '+(v===1&&k==='unidades'?'estabelecimento':names[k]||k)).join(', ')+'. ':'Temos soluções para organizar sua operação. Conheça os planos e seus recursos:\n\n'+live.filter(o=>o.family===p.id&&o.standalone).map(o=>planSummary(p,o)).join('\n\n')+'\n\n')+'Para recomendar o plano adequado, poderia informar a quantidade de '+missing.map(k=>names[k]||k).join(' e ')+'?',state.codes)};
 const i=recommend(p,profile.quantities,profile.needs);const offer=live.find(o=>o.family===p.id&&o.index===i&&o.standalone);const extras=profile.extras.map(c=>live.find(o=>o.code===c));
 if(!offer||extras.some(o=>!o))return {state,key,profile,result:response('Seu perfil precisa de confirmação comercial.',state.codes)};
 const additions=[offer,...extras];items=[...items.filter(o=>!additions.some(a=>a.family===o.family)),...additions];
 }else if(!show&&!inquiry&&(edit||simulation)&&family.length){
 const clauses=productText.replace(/inteligencia e ia/g,'inteligencia artificial').split(/\b(?:e|mais)\b/).filter(x=>Object.keys(families).some(k=>families[k].test(x)));
 const edits=family.length>1?clauses.filter(c=>family.some(k=>families[k].test(c))):[productText];
 const seen=new Set();
 for(const clause of edits){let fs=family.filter(k=>families[k].test(clause));if(fs.includes('CHATBOT'))fs=fs.filter(k=>k!=='IA');if(fs.length!==1||seen.has(fs[0]))return {state,key,result:response('Informe cada produto e seu plano separadamente.')};const f=fs[0];seen.add(f);
 if(remove){items=items.filter(o=>o.family!==f);continue;}
 if(f==='WEBSITE'&&!remove&&/\b(reservas online|agendamento online|pedidos online)\b/.test(clause)){continue;}
 const wanted=clause.match(/\b(core|eco|integra|basico|standard|profissional)\b/)?.[1]||(f==='CHATBOT'&&/\b(com ia|inteligencia artificial)\b/.test(clause)?'standard':null);const existing=items.find(o=>o.family===f);const offer=live.find(o=>o.family===f&&o.standalone&&(wanted?norm(o.level)===wanted:existing?o.code===existing.code:o.index===0));if(!offer)return {state,key,result:response('Não encontrei esse plano vigente. Informe o produto e o plano desejado.')};items=[...items.filter(o=>o.family!==f),offer];}
 if(seen.size!==family.length)return {state,key,result:response('Não consegui identificar todos os produtos solicitados.')};
 }
 if(integrated){items=items.map(o=>{const candidate=live.find(x=>!x.standalone&&x.family===o.family&&(x.index===o.index||(o.family==='WEBSITE'&&o.index===0&&x.index===null))&&eligible(x,items)&&x.price<o.price);return candidate||o;});}
 if(items.some(o=>!eligible(o,items)))return {state,key,result:response('A alteração deixaria um produto agregado sem seu requisito. Consulte nossa equipe antes de alterar.')};
 const activeProfile=profile||state.profile;
 const primary=portfolio.find(p=>p.id===activeProfile?.family);
 const pendingWebsite=edit&&family.includes('WEBSITE')&&!remove&&/\b(reservas online|agendamento online|pedidos online)\b/.test(q);
 const suggestions=[['WEBSITE',webUses[primary?.id]||'Website profissional'],['CHATBOT','Chatbot para automatizar o atendimento pelo WhatsApp'],['IA','Inteligência & IA para otimizar processos']].filter(([f])=>!items.some(o=>o.family===f)&&!(f==='WEBSITE'&&(pendingWebsite||state.profile?.pendingWebsite))&&live.some(o=>o.family===f&&o.standalone));
 const total=items.reduce((s,o)=>s+o.price,0);
 const individual=items.reduce((s,o)=>s+(live.find(x=>x.family===o.family&&x.standalone&&(o.family==='WEBSITE'&&o.index===null?x.index===0:x.index===o.index))?.price??o.price),0);
 const promo=individual>total?'\nValor individual de referência: '+money(individual)+'\nEconomia mensal: '+money(individual-total)+' | anual: '+money((individual-total)*12):'';
 const hypothetical=simulation||inquiry;
 const pending=Boolean(pendingWebsite||state.profile?.pendingWebsite)&&!(remove&&family.includes('WEBSITE'));
 if(!hypothetical&&!show&&(pending||state.profile?.pendingWebsite))profile={...(profile||state.profile||{}),pendingWebsite:pending};
 const facilities=items.length&&suggestions.length?'\n\n*Configure seu ecossistema PLENIUM*\n'+suggestions.map(([,label])=>'• '+label).join('\n')+'\nConfigure suas soluções integradas e aproveite nossos valores promocionais, conforme as condições de cada produto. Recursos e integrações sujeitos à confirmação e personalização. Quer adicionar alguma solução?':'';
 const rationale=profile&&primary?'Com base nas informações do seu negócio ('+Object.entries(profile.quantities).map(([k,v])=>v+' '+(v===1&&k==='unidades'?'estabelecimento':names[k]||k)).join(', ')+'), recomendamos um plano adequado à sua estrutura.\n\n':'';
 return {state,key,profile,result:response((hypothetical?'*SIMULAÇÃO PLENIUM* — sem alterar sua proposta\n\n':'*SUA PROPOSTA PLENIUM*\n\n')+rationale+(items.length?items.map(o=>o.index!=null?planSummary(portfolio.find(p=>p.id===o.family),o):'✓ '+o.name+' — '+money(o.price)+'/mês').join('\n\n'):'Nenhum produto selecionado.')+'\n\n*Investimento mensal: '+money(total)+'*'+promo+(hypothetical?'\nProposta atual: '+money(originalTotal)+'/mês. '+(total>=originalTotal?'Acréscimo':'Redução')+': '+money(Math.abs(total-originalTotal))+'/mês. Nenhuma alteração foi realizada. Deseja confirmar a inclusão?':'')+(pending?'\n\n*Website solicitado:* precisamos confirmar o plano e a integração necessária para reservas ou agendamentos online. A integração solicitada ainda não está orçada; o total considera apenas os planos já selecionados.':'')+(integrated&&!items.some(o=>!o.standalone)?'\n\nOs produtos selecionados ainda não atendem aos requisitos das ofertas agregadas. Website e IA promocionais exigem Gestão; podemos apresentar essa opção sem adicioná-la automaticamente.':'')+facilities+'\n\nSeja Plenium. Um ecossistema inteiro para o seu negócio.\nwww.pleniumgestao.com.br',show||hypothetical?undefined:items.map(o=>o.code))};
}
export async function saveCommercialMemory({job,context,base,headers,fetchImpl=fetch}){
 const r=await fetchImpl(base+'/rest/v1/rpc/nexus_save_commercial_profile',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_job_id:job.id,p_revision:context.revision,p_codes:context.codes,p_profile:context.profile??null})});return r.ok&&(await r.json())===true;
}
