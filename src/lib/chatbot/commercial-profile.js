import {portfolio,norm} from '../commercial/portfolio.js';
import {aliases,isPortalEntry} from './institutional-catalog.js';
const terms={unidades:'unidades?|filiais?|estabelecimentos?',quartos:'quartos?|uhs?',usuarios:'usuarios?',profissionais:'profissionais?',alunos:'alunos?',contratos:'contratos?',pdvs:'pdvs?',pets:'pets?'};
export function profileTurn(message,previous={}) {
 const q=norm(message).replace(/\b(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|vinte|trinta|quarenta|cinquenta|cem|duzentos|duzentas)\b/g,w=>({um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,vinte:20,trinta:30,quarenta:40,cinquenta:50,cem:100,duzentos:200,duzentas:200}[w])); if(message.startsWith('pl:')||isPortalEntry(q)||/\b(proposta|remover|trocar|substituir|excluir|retirar)\b/.test(q))return null;
 if(/\b(suporte|cancelar|reclamacao|atendente|humano|problema)\b/.test(q))return null;
 const candidates=portfolio.filter(p=>p.id!=='CHATBOT'&&Object.keys(p.limits).length&&aliases[p.id].test(q));
 const p=candidates.length===1?candidates[0]:candidates.length===0?portfolio.find(p=>p.id===previous.family):null;
 if(!p||!Object.keys(p.limits).length)return null;
 const quantities={...(previous.family===p.id?previous.quantities:{})};let found=false;
 for(const k of Object.keys(p.limits)){const m=q.match(new RegExp('(?:^| )([0-9]{1,7}) (?:'+(k==='unidades'?terms[k]+'|pousadas?|hoteis|hotel|lojas?|clinicas?|escolas?':k==='usuarios'?terms[k]+'|funcionarios? que (?:utilizarao|usarao) o sistema':terms[k])+')(?: |$)'));if(m&&Number(m[1])>0){quantities[k]=Number(m[1]);found=true;}}
 if(!found&&!(candidates.length===1&&/\b(tenho|preciso|busco|gostaria|sistema|solucao)\b/.test(q)&&!/\b(nao|sem|suporte|cancelar|problema|atendente|humano|preco|valor|planos|plano|adicionar|contratar)\b/.test(q)))return null;
 const features=p.features.flat().filter(f=>q.includes(norm(f))&&!/\b(sem|nao)\b/.test(q));
 const needs=[...new Set([...(previous.family===p.id?previous.needs||[]:[]),...features])];
 const extras=new Set(previous.family===p.id?previous.extras||[]:[]);
 if(!/\b(sem|nao)\b/.test(q)){if(/\b(chatbot|whatsapp)\b/.test(q)){extras.delete('CHATBOT_BASIC');extras.delete('CHATBOT_AI');extras.add(/\b(standard|com ia|inteligencia artificial)\b/.test(q)?'CHATBOT_AI':'CHATBOT_BASIC');}if(/\b(website|site)\b/.test(q))extras.add('WEBSITE_BASIC');if(/\b(gestao administrativa|fluxo de caixa)\b/.test(q))extras.add('GESTAO_CORE');}
 return {family:p.id,quantities,needs,extras:[...extras]};
}
export const profileTerms=terms;
