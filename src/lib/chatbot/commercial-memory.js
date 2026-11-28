import {benefitFor,commercialConcern,concernIntro} from './commercial-benefits.js';
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
 let profile=profileTurn(message,state.profile||{});
 if(/^(?:ola )?(?:gostaria de|quero) conhecer (?:as |os )?(?:solucoes|produtos)(?: da plenium)?$/.test(q))return {state,key};
 // Portal entries and explicit proposals must reach the catalog before any edit.
 if(isPortalEntry(q)||/\bproposta plenium\b/.test(q)||message.startsWith('pl:'))return {state,key};
 const simulation=/\b(simular|simulacao|quanto ficaria|quanto custaria|quanto sairia|qual seria|e se|se eu|beneficios de|vale a pena)\b/.test(q);
 const inquiry=!simulation&&/^(?:quais|qual|quanto|como|o que|me explique|gostaria de saber|quero saber)\b/.test(q);
 const concern=commercialConcern(q);
 const objection=Boolean(concern)&&! /^(?:adicione|inclua|remova|retire|quero adicionar|quero remover)\b/.test(q);
 const reset=/^(nova proposta|limpar proposta|reiniciar proposta|nova negociacao|comecar de novo|reiniciar atendimento)$/.test(q);
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
 const refused=/\b(nao quero|nao preciso|nao incluir|nao adicionar|nao contratar|dispenso)\b/.test(q);
 const budget=message.match(/(?:orçamento|orcamento|até|ate|no máximo|no maximo|posso pagar|limite de)\s*(?:de |é |e )?(?:R\$\s*)?(\d+(?:\.\d{3})*(?:,\d{1,2})?)(?![\d.,])/i);
 const closing=/^(?:quero contratar|desejo contratar|vamos contratar|confirmo a contratacao|quero fechar)(?: (?:a |essa |esta |minha )?proposta| o ecossistema)?$/.test(q);
 const compare=/\b(comparar|comparacao|diferenca|diferencas)\b/.test(q)&&!explicitEdit;
 const customize=/\b(personalizar|personalizacao|customizar|customizacao)\b/.test(q)&&!explicitEdit;
 if(!refused&&!budget&&!closing&&!compare&&!customize&&!objection&&!profile&&!reset&&!show&&!integrated&&!simulation&&!inquiry&&!(edit&&family.length&&!/\b(?:nao quero|nao preciso|nao incluir|nao adicionar|nao contratar)\b/.test(q)&&(!/\d/.test(q)||level)))return {state,key};
 const response=(reply,codes)=>({type:'catalog',reply,options:[{id:'pl:home',title:'Menu principal'},{id:'pl:offers',title:'Consultar ofertas'}],...(codes?{proposalCodes:codes}:{})});
 const prior=state.profile||{};
 const declined=Array.isArray(prior.declinedFamilies)?prior.declinedFamilies:[];
 if(refused){const next=[...new Set([...declined,...family])];return {state,key,profile:{...prior,declinedFamilies:next},result:response('Tudo bem. Respeitaremos sua preferência e mantivemos sua proposta sem alterações. Caso queira retirar um produto já selecionado, informe qual.',state.codes)};}

 if(/\b(retirar|remover|excluir)\b/.test(q)&&/\b(adicionar|incluir|acrescentar)\b/.test(q))return {state,key,result:response('Para evitar alterações incorretas, informe primeiro os produtos a retirar e depois os que deseja adicionar.')};
 if(reset)return {state,key,profile:{},result:response('*Nova proposta*\n\nComposição anterior limpa. Informe seu segmento e necessidades.',[])};
 const rr=await fetchImpl(base+'/rest/v1/nexus_products?select=code,monthly_price,active,standalone&active=eq.true&limit=501',{headers,cache:'no-store'});if(!rr.ok)throw Error('commercial_catalog_read');const data=await rr.json();if(!Array.isArray(data)||data.length>500)throw Error('commercial_catalog_invalid');const live=liveOffers(data);
 let items=state.codes.map(c=>live.find(o=>o.code===c));if(items.some(x=>!x))return {state,key,result:response('Sua composição contém ofertas indisponíveis. Digite nova proposta para recomeçar ou consulte nossa equipe.')};
 const originalTotal=items.reduce((sum,o)=>sum+o.price,0);
 if(closing)return {state,key,result:response(items.length?'*Formalização comercial PLENIUM*\n'+items.map(o=>o.name+' — '+money(o.price)+'/mês').join('\n')+'\nTotal mensal: '+money(originalTotal)+(prior.pendingWebsite?'\nWebsite ainda pendente de orçamento.':'')+'\nPara confirmar escopo, condições e formalizar a contratação, entre em contato com contato@pleniumgestao.com.br. Nenhum contrato ou cobrança foi gerado.':'Informe primeiro os produtos que deseja contratar.')};
 if(customize)return {state,key,result:response('Podemos personalizar as soluções conforme as necessidades do seu negócio. Quais processos, recursos ou integrações você precisa? A equipe comercial confirmará a viabilidade e os valores. Sua proposta permanece sem alterações.')};
 if(compare){const fs=family.length?family:[prior.family||items[0]?.family].filter(Boolean);return {state,key,result:response(fs.map(f=>live.filter(o=>o.family===f&&o.standalone).map(o=>planSummary(portfolio.find(p=>p.id===f),o)).join('\n\n')).join('\n\n')+'\nSua proposta permanece sem alterações.')};}
 if(budget){const amount=Number(budget[1].replace(/\./g,'').replace(',','.'));const primary=items.find(o=>o.family===prior.family)||items.find(o=>!['GESTAO','IA','CHATBOT','WEBSITE'].includes(o.family))||items[0];if(!primary)return {state,key,result:response('Qual seu segmento e quais recursos são essenciais para recomendar uma opção dentro do orçamento?')};const baseOffer=primary.standalone?primary:live.find(o=>o.family===primary.family&&o.index===primary.index&&o.standalone);let choice=baseOffer?[baseOffer]:[];if(!choice.length||baseOffer.price>amount)return {state,key,result:response('O plano principal selecionado não cabe no orçamento de '+money(amount)+'. Precisamos revisar suas necessidades sem reduzir a capacidade automaticamente. Sua proposta permanece sem alterações.')};for(const o of items){if(o.family===primary.family||declined.includes(o.family))continue;const candidate=eligible(o,choice)?o:live.find(x=>x.family===o.family&&x.index===o.index&&x.standalone);if(candidate&&choice.reduce((a,x)=>a+x.price,0)+candidate.price<=amount)choice.push(candidate);}return {state,key,result:response('*Simulação por orçamento — sem alterar sua proposta*\n'+choice.map(o=>o.name+' — '+money(o.price)+'/mês').join('\n')+'\nTotal: '+money(choice.reduce((a,o)=>a+o.price,0))+'/mês. Orçamento: '+money(amount)+'/mês.\nInforme expressamente os produtos que deseja manter ou retirar.')};}

 if(objection&&items.length){
 const primary=items.find(o=>o.family===state.profile?.family)||items.find(o=>!['GESTAO','IA','CHATBOT','WEBSITE'].includes(o.family));
 const benefits=items.map(o=>'• '+o.name+': '+benefitFor(o)).join('\n');
 const comparison=primary?'\nApenas '+primary.name+': '+money(primary.price)+'/mês. O conjunto custa '+money(originalTotal)+'/mês, diferença de '+money(originalTotal-primary.price)+'/mês.':'';
 const reference=items.reduce((sum,o)=>sum+(live.find(x=>x.family===o.family&&x.standalone&&(o.family==='WEBSITE'&&o.index===null?x.index===0:x.index===o.index))?.price??o.price),0);
 const savings=reference>originalTotal?'\nEconomia sobre os valores individuais: '+money(reference-originalTotal)+'/mês e '+money((reference-originalTotal)*12)+'/ano.':'';
 const priority=/custos/.test(q)?'Para priorizar custos, podemos avaliar primeiro os recursos de controle financeiro e organização operacional.':/atendimento/.test(q)?'Para priorizar atendimento, podemos avaliar a automação de perguntas frequentes e a organização dos contatos.':/vendas|faturamento/.test(q)?'Para priorizar vendas, podemos avaliar os canais de atendimento e divulgação adequados ao negócio.':'';
 const reply=concernIntro(concern)+'\n\n'+benefits+'\n'+comparison+savings+'\n'+priority+' Os resultados financeiros dependem da utilização e da realidade do negócio. Podemos priorizar as soluções essenciais sem alterar sua proposta agora.'+(state.profile?.pendingWebsite?' O Website solicitado continua pendente de orçamento.':'')+'\n\n'+(concern==='timing'?'Quando desejar, podemos retomar sua proposta.':concern==='competition'?'Quais recursos ou condições você gostaria de comparar?':concern==='priority'?'Deseja comparar uma composição mais enxuta, sem alterar sua proposta?':'Qual sua prioridade: reduzir custos, melhorar o atendimento ou ampliar as vendas?')+'\n\nSeja Plenium. Um ecossistema inteiro para o seu negócio.\nwww.pleniumgestao.com.br';
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
 const suggestions=[['WEBSITE',webUses[primary?.id]||'Website profissional'],['CHATBOT','Chatbot para automatizar o atendimento pelo WhatsApp'],['IA','Inteligência & IA para otimizar processos']].filter(([f])=>!declined.includes(f)&&!items.some(o=>o.family===f)&&!(f==='WEBSITE'&&(pendingWebsite||state.profile?.pendingWebsite))&&live.some(o=>o.family===f&&o.standalone));
 const total=items.reduce((s,o)=>s+o.price,0);
 const individual=items.reduce((s,o)=>s+(live.find(x=>x.family===o.family&&x.standalone&&(o.family==='WEBSITE'&&o.index===null?x.index===0:x.index===o.index))?.price??o.price),0);
 const promo=individual>total?'\nValor individual de referência: '+money(individual)+'\nEconomia mensal: '+money(individual-total)+' | anual: '+money((individual-total)*12):'';
 const hypothetical=simulation||inquiry;
 const pending=Boolean(pendingWebsite||state.profile?.pendingWebsite)&&!(remove&&family.includes('WEBSITE'));
 if(!hypothetical&&!show&&(pending||state.profile?.pendingWebsite))profile={...(profile||state.profile||{}),pendingWebsite:pending};
 const facilities=items.length&&suggestions.length?'\n\n*Configure seu ecossistema PLENIUM*\n'+suggestions.map(([,label])=>'• '+label).join('\n')+'\nConfigure suas soluções integradas e aproveite nossos valores promocionais, conforme as condições de cada produto. Recursos e integrações sujeitos à confirmação e personalização. Quer adicionar alguma solução?':'';
 if(!hypothetical&&!show){profile={...prior,...(profile||{}),declinedFamilies:declined.filter(f=>!(explicitEdit&&!remove&&family.includes(f)))};}
 const rationale=profile&&primary&&profile.quantities?'Com base nas informações do seu negócio ('+Object.entries(profile.quantities).map(([k,v])=>v+' '+(v===1&&k==='unidades'?'estabelecimento':names[k]||k)).join(', ')+'), recomendamos um plano adequado à sua estrutura.\n\n':'';
 return {state,key,profile,result:response((hypothetical?'*SIMULAÇÃO PLENIUM* — sem alterar sua proposta\n\n':'*SUA PROPOSTA PLENIUM*\n\n')+rationale+(items.length?items.map(o=>o.index!=null?planSummary(portfolio.find(p=>p.id===o.family),o):'✓ '+o.name+' — '+money(o.price)+'/mês').join('\n\n'):'Nenhum produto selecionado.')+'\n\n*Investimento mensal: '+money(total)+'*'+promo+(hypothetical?'\nProposta atual: '+money(originalTotal)+'/mês. '+(total>=originalTotal?'Acréscimo':'Redução')+': '+money(Math.abs(total-originalTotal))+'/mês. Nenhuma alteração foi realizada. Deseja confirmar a inclusão?':'')+(pending?'\n\n*Website solicitado:* precisamos confirmar o plano e a integração necessária para reservas ou agendamentos online. A integração solicitada ainda não está orçada; o total considera apenas os planos já selecionados.':'')+(integrated&&!items.some(o=>!o.standalone)?'\n\nOs produtos selecionados ainda não atendem aos requisitos das ofertas agregadas. Website e IA promocionais exigem Gestão; podemos apresentar essa opção sem adicioná-la automaticamente.':'')+facilities+'\n\nSeja Plenium. Um ecossistema inteiro para o seu negócio.\nwww.pleniumgestao.com.br',show||hypothetical?undefined:items.map(o=>o.code))};
}
export async function saveCommercialMemory({job,context,base,headers,fetchImpl=fetch}){
 const r=await fetchImpl(base+'/rest/v1/rpc/nexus_save_commercial_profile',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_job_id:job.id,p_revision:context.revision,p_codes:context.codes,p_profile:context.profile??null})});return r.ok&&(await r.json())===true;
}
