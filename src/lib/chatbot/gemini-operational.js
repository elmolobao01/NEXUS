import { geminiCommercialSandbox } from './gemini-commercial.js';
import { INSTITUTIONAL_ORG } from './institutional-catalog.js';
import { norm } from '../commercial/portfolio.js';

// Only immutable public fixtures reach the free provider. No customer text or memory.
const cues = Object.freeze({
  lodging: /\b(reservas|hospedes|hospedagem|ocupacao dos quartos)\b/,
  shop: /\b(vender pela internet|vender online|vendas online|comercio eletronico)\b/,
  automation: /\b(automatizar (?:o )?atendimento|respostas automaticas|automatizar respostas)\b/,
  administration: /\b(controle financeiro|organizar financas|contas a pagar|fluxo de caixa)\b/,
  website: /\b(divulgar (?:meus |os )?servicos|pagina institucional|presenca digital)\b/,
});
export async function operationalGemini({job,planCode,config,message,base,headers,fetchImpl=fetch,enabled=process.env.CHATBOT_GEMINI_OPERATIONAL_ENABLED==='true',classify=geminiCommercialSandbox}={}) {
  if(!enabled || job?.organization_id!==INSTITUTIONAL_ORG || job?.phone_number_id!=='1453993444467017' || planCode!=='CHATBOT_AI' || !config?.active || typeof message!=='string' || message.length>1000 || message.startsWith('pl:')) return null;
  const q=norm(message);
  if(/\b(nao|sem|retirar|remover|cancelar|suporte|humano|atendente|reclamacao)\b/.test(q)) return null;
  const matches=Object.keys(cues).filter(k=>cues[k].test(q));
  if(matches.length!==1) return null;
  try {
    const result=await classify({caseId:matches[0],organizationId:job.organization_id,planCode,config,base,headers,fetchImpl,enabled:true});
    return result?.ai_used===true && typeof result.reply==='string' && result.reply.trim() && result.reply.length<=4096 ? {...result,allow:true,engine:'ai'} : null;
  } catch { return null; }
}
