const BASE_URL = "https://api.groq.com/openai/v1";

function textOf(input) {
  return typeof input === "string" ? input : JSON.stringify(input);
}

export async function executeGroq({ input, modelCode, metadata = {} }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("AI_GROQ_API_KEY_NOT_CONFIGURED");
  if (!modelCode) throw new Error("AI_GROQ_MODEL_NOT_CONFIGURED");

  const body = {
    model: modelCode,
    messages: [{ role: "user", content: textOf(input) }],
    temperature: Number.isFinite(Number(metadata.temperature)) ? Number(metadata.temperature) : 0.2,
    max_completion_tokens: Number.isFinite(Number(metadata.maxOutputTokens)) ? Number(metadata.maxOutputTokens) : 2048,
    stream: false,
  };

  // Para os casos estruturados do Benchmark, pedimos JSON nativo quando possível.
  if (metadata.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

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
    if (response.status === 429) throw new Error(`AI_GROQ_RATE_LIMIT:${message}`);
    throw new Error(`AI_GROQ_ERROR:${message}`);
  }

  const output = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!output) throw new Error("AI_GROQ_EMPTY_RESPONSE");

  const usage = data?.usage || {};
  const inputTokens = Number(usage.prompt_tokens || 0);
  const outputTokens = Number(usage.completion_tokens || 0);

  return {
    output,
    inputTokens,
    outputTokens,
    providerRequestId: data?.id || response.headers.get("x-request-id") || null,
    // A v0.7 cadastra o Groq como camada FREE. Enquanto a conta estiver no Free Plan,
    // o custo financeiro da chamada para a PLENIUM é zero. O consumo continua registrado.
    providerCostUsd: 0,
    providerUsage: {
      freeTier: true,
      totalTokens: Number(usage.total_tokens || (inputTokens + outputTokens)),
    },
  };
}
