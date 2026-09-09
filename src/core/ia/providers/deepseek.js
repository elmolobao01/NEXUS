const BASE_URL = "https://api.deepseek.com";

function isPeakUtc(date = new Date()) {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  const hour = date.getUTCHours();
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10);
}

function deepSeekCost(usage = {}, date = new Date()) {
  const peak = isPeakUtc(date);
  const hitRate = peak ? 0.014 : 0.007;
  const missRate = peak ? 0.44 : 0.22;
  const outputRate = peak ? 1.32 : 0.66;

  const hit = Number(usage.prompt_cache_hit_tokens || 0);
  const missRaw = usage.prompt_cache_miss_tokens;
  const prompt = Number(usage.prompt_tokens || 0);
  const miss = missRaw == null ? Math.max(0, prompt - hit) : Number(missRaw || 0);
  const output = Number(usage.completion_tokens || 0);

  return {
    providerCostUsd: (hit / 1_000_000) * hitRate + (miss / 1_000_000) * missRate + (output / 1_000_000) * outputRate,
    pricingWindow: peak ? "peak" : "off_peak",
    promptCacheHitTokens: hit,
    promptCacheMissTokens: miss,
  };
}

export async function executeDeepSeek({ input, modelCode, metadata = {} }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("AI_DEEPSEEK_API_KEY_NOT_CONFIGURED");
  if (!modelCode) throw new Error("AI_DEEPSEEK_MODEL_NOT_CONFIGURED");

  const text = typeof input === "string" ? input : JSON.stringify(input);
  const body = {
    model: modelCode,
    messages: [{ role: "user", content: text }],
    thinking: { type: "disabled" },
    temperature: Number.isFinite(Number(metadata.temperature)) ? Number(metadata.temperature) : 0.2,
    max_tokens: Number.isFinite(Number(metadata.maxOutputTokens)) ? Number(metadata.maxOutputTokens) : 2048,
    stream: false,
  };

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `HTTP_${response.status}`;
    throw new Error(`AI_DEEPSEEK_ERROR:${message}`);
  }

  const output = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!output) throw new Error("AI_DEEPSEEK_EMPTY_RESPONSE");

  const usage = data?.usage || {};
  const pricing = deepSeekCost(usage);
  return {
    output,
    inputTokens: Number(usage.prompt_tokens || 0),
    outputTokens: Number(usage.completion_tokens || 0),
    providerRequestId: data?.id || response.headers.get("x-request-id") || null,
    providerCostUsd: pricing.providerCostUsd,
    providerUsage: {
      pricingWindow: pricing.pricingWindow,
      promptCacheHitTokens: pricing.promptCacheHitTokens,
      promptCacheMissTokens: pricing.promptCacheMissTokens,
    },
  };
}
