export async function executeMock({ input, operationType }) {
  const text = typeof input === "string" ? input : JSON.stringify(input);
  return { output: `[PLENIUM AI MOCK:${operationType}] ${text.slice(0, 500)}`, inputTokens: Math.ceil(text.length / 4), outputTokens: Math.ceil(Math.min(text.length, 500) / 4), providerRequestId: null };
}
