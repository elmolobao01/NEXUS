const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function extractText(data) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text || "")
    .join("")
    .trim();
}

export async function executeGoogle({ input, modelCode, metadata = {} }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("AI_GOOGLE_API_KEY_NOT_CONFIGURED");
  if (!modelCode) throw new Error("AI_GOOGLE_MODEL_NOT_CONFIGURED");

  const text = typeof input === "string" ? input : JSON.stringify(input);
  const generationConfig = {
    temperature: Number.isFinite(Number(metadata.temperature)) ? Number(metadata.temperature) : 0.2,
    maxOutputTokens: Number.isFinite(Number(metadata.maxOutputTokens)) ? Number(metadata.maxOutputTokens) : 2048,
  };
  if (metadata.responseMimeType) generationConfig.responseMimeType = metadata.responseMimeType;

  const response = await fetch(`${BASE_URL}/models/${encodeURIComponent(modelCode)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text }] }], generationConfig }),
    cache: "no-store",
  });

  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const message = data?.error?.message || `HTTP_${response.status}`;
    throw new Error(`AI_GOOGLE_ERROR:${message}`);
  }

  const output = extractText(data);
  if (!output) throw new Error("AI_GOOGLE_EMPTY_RESPONSE");
  return {
    output,
    inputTokens: Number(data?.usageMetadata?.promptTokenCount || 0),
    outputTokens: Number(data?.usageMetadata?.candidatesTokenCount || 0),
    providerRequestId: response.headers.get("x-request-id") || null,
  };
}
