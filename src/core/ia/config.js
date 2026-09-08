export const AI_LEVELS = Object.freeze({
  LOCAL: 0,
  ULTRA_ECONOMY: 1,
  ECONOMY: 2,
  ADVANCED: 3,
  CRITICAL: 4,
});

export const AI_OPERATION_TYPES = Object.freeze([
  "assistant",
  "knowledge",
  "docs",
  "analytics",
]);

// Aliases externos/funcionais -> catálogo operacional estável do Engine.
// O Benchmark pode usar nomes descritivos sem multiplicar rotas internas.
export const AI_OPERATION_ALIASES = Object.freeze({
  classify_text: "assistant",
  summarize_text: "assistant",
  draft_communication: "assistant",
  extract_structured: "docs",
  analyze_metrics: "analytics",
});

export function normalizeAiOperationType(value) {
  const raw = String(value || "assistant").trim().toLowerCase();
  const normalized = AI_OPERATION_ALIASES[raw] || raw;
  if (!AI_OPERATION_TYPES.includes(normalized)) {
    throw new Error("AI_OPERATION_TYPE_INVALID");
  }
  return { raw, normalized };
}

export function normalizeAiRequest(body = {}) {
  const operation = normalizeAiOperationType(body.operationType);
  const level = Math.max(
    0,
    Math.min(4, Number.isFinite(Number(body.level)) ? Number(body.level) : 1),
  );
  const input = typeof body.input === "string" ? body.input.trim() : body.input;

  if (!input || (typeof input === "string" && input.length > 100000)) {
    throw new Error("AI_INPUT_INVALID");
  }

  const incomingMetadata =
    body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  return {
    operationType: operation.normalized,
    level,
    input,
    metadata: {
      ...incomingMetadata,
      requestedOperationType: operation.raw,
      normalizedOperationType: operation.normalized,
    },
  };
}
