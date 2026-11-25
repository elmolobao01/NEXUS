// Institutional preview only. No customer messages or tenant configuration sent.
export async function geminiPreview({ topic, base, headers, fetchImpl = fetch, key = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL } = {}) {
  const topics = { 'teste ia website': 'Explique genericamente a diferença entre site institucional e loja virtual.', 'teste ia gestao': 'Explique genericamente os benefícios de organizar a gestão de uma pequena empresa.', 'teste ia chatbot': 'Explique genericamente como um chatbot pode auxiliar no atendimento comercial.' };
  const prompt = topics[String(topic).trim().toLowerCase()];
  if (!prompt || !key || model !== 'gemini-2.5-flash-lite') return null;
  try {
    const r = await fetchImpl(`${base}/rest/v1/rpc/nexus_reserve_gemini_preview`, {method:'POST', headers, body:'{}', cache:'no-store'});
    if (!r.ok || (await r.json()) !== true) return null;
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {method:'POST', headers:{'x-goog-api-key':key,'Content-Type':'application/json'}, body:JSON.stringify({contents:[{parts:[{text:prompt}]}],systemInstruction:{parts:[{text:'Responda em português brasileiro, em até 120 palavras. Não invente preços, funcionalidades da PLENIUM ou promessas comerciais.'}]},generationConfig:{maxOutputTokens:300,temperature:0.3}}),signal:AbortSignal.timeout(15000),cache:'no-store'});
    if (!response.ok) return null;
    const data = await response.json();
    const candidate = data.candidates?.[0];
    const reply = candidate?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('').trim();
    return reply && reply.length<=4096 ? {type:'ai',reply} : null;
  } catch { return null; }
}
