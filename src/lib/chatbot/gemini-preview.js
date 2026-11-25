// Institutional preview only. No customer messages or tenant configuration sent.
export async function geminiPreview({ topic, base, headers, fetchImpl = fetch, key = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL } = {}) {
  const topics = { 'teste ia website': 'Explique genericamente a diferença entre site institucional e loja virtual.', 'teste ia gestao': 'Explique genericamente os benefícios de organizar a gestão de uma pequena empresa.', 'teste ia chatbot': 'Explique genericamente como um chatbot pode auxiliar no atendimento comercial.' };
  const prompt = topics[String(topic).trim().toLowerCase()];
  if (!prompt) return null;
  const failure = (code, extra = {}) => ({ diagnostic: { code, ...extra } });
  model = String(model || '').trim().replace(/^models\//, '');
  if (!key || !/^gemini-[a-z0-9][a-z0-9.-]{0,100}$/.test(model)) return failure('configuration_invalid');
  let stage = 'model_lookup';
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}`;
    const metadata = await fetchImpl(endpoint, {headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(5000),cache:'no-store'});
    if (!metadata.ok) return failure('model_lookup_error', {http_status:metadata.status});
    const info = await metadata.json();
    if (info.name !== `models/${model}` || !info.supportedGenerationMethods?.includes('generateContent')) return failure('model_unsupported');
    stage = 'quota';
    const r = await fetchImpl(`${base}/rest/v1/rpc/nexus_reserve_gemini_preview`, {method:'POST', headers, body:'{}', signal:AbortSignal.timeout(5000), cache:'no-store'});
    if (!r.ok) return failure('quota_error', { http_status: r.status });
    if ((await r.json()) !== true) return failure('quota_exhausted');
    stage = 'provider';
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {method:'POST', headers:{'x-goog-api-key':key,'Content-Type':'application/json'}, body:JSON.stringify({contents:[{parts:[{text:prompt}]}],systemInstruction:{parts:[{text:'Responda em português brasileiro, em até 120 palavras. Não invente preços, funcionalidades da PLENIUM ou promessas comerciais.'}]},generationConfig:{maxOutputTokens:768,temperature:0.3,...(model.startsWith('gemini-2.5-flash') ? {thinkingConfig:{thinkingBudget:0}} : {})}}),signal:AbortSignal.timeout(15000),cache:'no-store'});
    if (!response.ok) return failure('provider_http_error', { http_status: response.status });
    const data = await response.json();
    const candidate = data.candidates?.[0];
    const reply = candidate?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('').trim();
    return reply && reply.length<=4096 ? {type:'ai',reply,diagnostic:{code:'success'}} : failure('empty_or_invalid_response', { finish_reason: ['STOP','MAX_TOKENS','SAFETY','RECITATION','OTHER'].includes(candidate?.finishReason) ? candidate.finishReason : 'UNKNOWN' });
  } catch (error) { return failure(stage + (error?.name === 'TimeoutError' ? '_timeout' : '_failure')); }
}
