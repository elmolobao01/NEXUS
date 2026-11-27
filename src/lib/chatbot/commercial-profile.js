import {portfolio,norm} from '../commercial/portfolio.js';
import {aliases,isPortalEntry} from './institutional-catalog.js';
const terms={unidades:'unidades?|filiais?|estabelecimentos?',quartos:'quartos?|uhs?',usuarios:'usuarios?',profissionais:'profissionais?',alunos:'alunos?',contratos:'contratos?',pdvs:'pdvs?',pets:'pets?'};
export function profileTurn(message,previous={}) {
 const q=norm(message); if(message.startsWith('pl:')||isPortalEntry(q)||/\b(proposta|remover|trocar|substituir|excluir|retirar)\b/.test(q))return null;
 const candidates=portfolio.filter(p=>p.id!=='CHATBOT'&&Object.keys(p.limits).length&&aliases[p.id].test(q));
 const p=candidates.length===1?candidates[0]:candidates.length===0?portfolio.find(p=>p.id===previous.family):null;
 if(!p||!Object.keys(p.limits).length)return null;
 const quantities={...(previous.family===p.id?previous.quantities:{})};let found=false;
 for(const k of Object.keys(p.limits)){const m=q.match(new RegExp('(?:^| )([0-9]{1,7}) (?:'+terms[k]+')(?: |$)'));if(m&&Number(m[1])>0){quantities[k]=Number(m[1]);found=true;}}
 if(!found)return null;
 const features=p.features.flat().filter(f=>q.includes(norm(f))&&!/\b(sem|nao)\b/.test(q));
 const needs=[...new Set([...(previous.family===p.id?previous.needs||[]:[]),...features])];
 const extras=new Set(previous.family===p.id?previous.extras||[]:[]);
 if(!/\b(sem|nao)\b/.test(q)){if(/\b(chatbot|whatsapp)\b/.test(q)){extras.delete('CHATBOT_BASIC');extras.delete('CHATBOT_AI');extras.add(/\b(standard|com ia|inteligencia artificial)\b/.test(q)?'CHATBOT_AI':'CHATBOT_BASIC');}if(/\b(website|site)\b/.test(q))extras.add('WEBSITE_BASIC');if(/\b(gestao administrativa|fluxo de caixa)\b/.test(q))extras.add('GESTAO_CORE');}
 return {family:p.id,quantities,needs,extras:[...extras]};
}
export const profileTerms=terms;
