// Public, immutable sales guidance only. Never transmit inbound text or memory.
import { INSTITUTIONAL_ORG } from './institutional-catalog.js';
const guidance=Object.freeze({
 simulation:Object.freeze(['Podemos comparar as alternativas antes de você decidir.','Vamos avaliar o investimento e os benefícios de cada alternativa.']),
 proposal:Object.freeze(['Podemos personalizar as soluções conforme as necessidades do seu negócio.','Vamos avaliar juntos quais soluções fazem sentido para sua operação.']),
 objection:Object.freeze(['Podemos começar pelas soluções prioritárias e ampliar o ecossistema conforme a necessidade.','Vale comparar o investimento adicional com as tarefas e oportunidades que cada solução pode apoiar.']),
 consultation:Object.freeze(['Podemos ajudar você a escolher a solução mais adequada ao seu negócio.','Vamos conhecer suas necessidades para orientar sua escolha.'])
});
export async function commercialGuidance({job,planCode,config,kind,base,headers,fetchImpl=fetch,key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL,audit=()=>{},enabled=process.env.CHATBOT_GEMINI_OPERATIONAL_ENABLED==='true'}={}){
 const start=Date.now();let attempted=false,http=null;
 const finish=(reason,phrase=null)=>{audit({gemini_enabled:enabled,gemini_attempted:attempted,gemini_used:Boolean(phrase),gemini_model:/^gemini-[a-z0-9][a-z0-9.-]{0,100}$/.test(model||'')?model:null,gemini_latency_ms:Date.now()-start,gemini_http_status:http,fallback_reason:reason,commercial_intent:kind});return phrase;};
 if(!enabled||job?.organization_id!==INSTITUTIONAL_ORG||job?.phone_number_id!=='1453993444467017'||planCode!=='CHATBOT_AI'||!config?.active||!Object.hasOwn(guidance,kind))return finish('not_authorized');
 model=String(model||'').replace(/^models\//,'');if(!key||!/^gemini-[a-z0-9][a-z0-9.-]{0,100}$/.test(model))return finish('configuration_invalid');
 try{
 const quota=await fetchImpl(`${base}/rest/v1/rpc/nexus_reserve_gemini_commercial_sandbox`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:AbortSignal.timeout(5000)});
 if(!quota.ok||await quota.json()!==true)return finish('quota_unavailable_or_exhausted');
 attempted=true;
 const r=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'Cenário comercial fictício: '+kind+'. Escolha a frase de orientação mais natural: '+JSON.stringify(guidance[kind])+'. Retorne apenas JSON {"choice":0} ou {"choice":1}.'}]}],generationConfig:{temperature:0,maxOutputTokens:256,responseMimeType:'application/json'}}),cache:'no-store',signal:AbortSignal.timeout(10000)});
 http=r.status??null; if(!r.ok)return finish('provider_unavailable');const c=(await r.json()).candidates?.[0];if(c?.finishReason!=='STOP')return finish('provider_incomplete');
 const p=JSON.parse(c.content?.parts?.filter(x=>!x.thought).map(x=>x.text||'').join('')||'');
 return Object.keys(p).length===1&&Number.isInteger(p.choice)&&Object.hasOwn(guidance[kind],p.choice)?finish(null,guidance[kind][p.choice]):finish('invalid_choice');
 }catch{return finish('execution_failed');}
}
export function guidanceKind(result){if(result?.type!=='catalog'||typeof result.reply!=='string')return null; if(result.commercialIntent==='objection')return 'objection'; if(result.reply.startsWith('*SIMULAÇÃO PLENIUM*'))return 'simulation';if(result.reply.startsWith('*SUA PROPOSTA PLENIUM*')&&result.proposalCodes?.length)return 'proposal';return null;}
