// Motor determinístico compartilhado pelos planos BASIC e AI. Não chama provedores de IA.
const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const words = (value) => new Set(normalize(value).split(" ").filter(w => w.length > 2));
export function basicReply(config, input) {
  const message = String(input ?? "").trim().slice(0, 1000);
  if (!message) return { type: "invalid", reply: "Digite uma mensagem para testar." };
  if (!config?.active) return { type: "inactive", reply: "O chatbot está desativado nas configurações." };
  const norm = normalize(message);
  if (/^(oi|ola|bom dia|boa tarde|boa noite|menu|inicio)$/.test(norm)) return { type: "welcome", reply: config.welcome_message || "Olá! Como posso ajudar?" };
  if (/^(tchau|ate logo|obrigado|obrigada|valeu)$/.test(norm)) return { type: "closing", reply: config.closing_message || "Obrigado pelo contato!" };
  const candidates = (Array.isArray(config.faq) ? config.faq : []).map((item, index) => {
    const question = normalize(item.question);
    const answer = String(item.answer ?? "").trim();
    if (!question || !answer) return null;
    const exact = norm === question;
    const a = words(message), b = words(item.question);
    const overlap = [...a].filter(x => b.has(x)).length;
    const score = exact ? 1 : (a.size && b.size ? overlap / Math.max(a.size, b.size) : 0);
    return { index, answer, score };
  }).filter(Boolean).sort((a,b)=>b.score-a.score || a.index-b.index);
  // Do not guess when two distinct FAQ intents have comparable evidence.
  // Exact matches retain precedence; partial matches require a clear winner.
  const best = candidates[0];
  const runnerUp = candidates.find(c => c.index !== best?.index && c.score > 0);
  const ambiguous = best && best.score < 1 && runnerUp &&
    runnerUp.score >= 0.45 && (best.score - runnerUp.score) < 0.20;
  if (best?.score >= 0.65 && !ambiguous) return { type: "faq", reply: best.answer };
  return { type: "fallback", reply: "Não encontrei uma resposta programada para essa pergunta. Vou encaminhar seu atendimento para um responsável." };
}
