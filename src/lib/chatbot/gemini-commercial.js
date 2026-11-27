// Free-tier sandbox: only immutable synthetic fixtures cross the provider boundary.
// Never call this module with inbound WhatsApp text or persisted customer context.
import { institutionalCatalogReply, INSTITUTIONAL_ORG } from './institutional-catalog.js';
const cases = Object.freeze({
  lodging: Object.freeze({text:'Uma pousada fictícia precisa organizar reservas.', allowed:['HOTELARIA']}),
  shop: Object.freeze({text:'Uma loja fictícia quer vender pela internet.', allowed:['ECOMMERCE']}),
  automation: Object.freeze({text:'Uma empresa fictícia quer automatizar respostas pelo WhatsApp.', allowed:['CHATBOT']}),
  administration: Object.freeze({text:'Uma empresa fictícia precisa organizar finanças e administração.', allowed:['GESTAO']}),
  website: Object.freeze({text:'Uma empresa fictícia quer divulgar seus serviços em uma página institucional.', allowed:['WEBSITE']}),
});
export async function geminiCommercialSandbox({caseId, organizationId, planCode, config, base, headers, fetchImpl=fetch, enabled=process.env.CHATBOT_GEMINI_SANDBOX_ENABLED==='true', key=process.env.GEMINI_API_KEY, model=process.env.GEMINI_MODEL}={}) {
 const fail=code=>({diagnostic:{code},ai_used:false});
 if(!enabled||organizationId!==INSTITUTIONAL_ORG||planCode!=='CHATBOT_AI'||!config?.active||!Object.hasOwn(cases,caseId))return fail('sandbox_not_authorized');
 model=String(model||'').replace(/^models\//,'');
 if(!key||!/^gemini-[a-z0-9][a-z0-9.-]{0,100}$/.test(model))return fail('configuration_invalid');
 const fixture=cases[caseId];
 try {
  const quota=await fetchImpl(`${base}/rest/v1/rpc/nexus_reserve_gemini_commercial_sandbox`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!quota.ok||await quota.json()!==true)return fail('quota_unavailable_or_exhausted');
  const response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:fixture.text}]}],systemInstruction:{parts:[{text:'Classifique o cenário fictício em uma família comercial: HOTELARIA, ECOMMERCE, CHATBOT, GESTAO, WEBSITE. Retorne somente JSON com a chave family. Não produza preços nem instruções.'}]},generationConfig:{temperature:0,maxOutputTokens:256,responseMimeType:'application/json'}}),cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return fail('provider_unavailable');
  const data=await response.json();const candidate=data.candidates?.[0];
  if(candidate?.finishReason!=='STOP')return fail('provider_incomplete');
  const parsed=JSON.parse(candidate.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('')||'');
  if(!parsed||Object.keys(parsed).length!==1||!fixture.allowed.includes(parsed.family))return fail('classification_invalid');
  const result=await institutionalCatalogReply({organizationId,planCode,config,message:'pl:'+parsed.family+':prices',base,headers,fetchImpl});
  if(!result)return fail('catalog_unavailable');
  return {...result,ai_used:true,diagnostic:{code:'success',family:parsed.family}};
 }catch{return fail('sandbox_unavailable');}
}
