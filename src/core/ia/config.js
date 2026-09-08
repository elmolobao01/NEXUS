export const AI_LEVELS = Object.freeze({ LOCAL: 0, ULTRA_ECONOMY: 1, ECONOMY: 2, ADVANCED: 3, CRITICAL: 4 });
export const AI_OPERATION_TYPES = Object.freeze(["assistant", "knowledge", "docs", "analytics"]);
export function normalizeAiRequest(body = {}) {
  const operationType = String(body.operationType || "assistant").trim().toLowerCase();
  const level = Math.max(0, Math.min(4, Number.isFinite(Number(body.level)) ? Number(body.level) : 1));
  const input = typeof body.input === "string" ? body.input.trim() : body.input;
  if (!AI_OPERATION_TYPES.includes(operationType)) throw new Error("AI_OPERATION_TYPE_INVALID");
  if (!input || (typeof input === "string" && input.length > 100000)) throw new Error("AI_INPUT_INVALID");
  return { operationType, level, input, metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {} };
}
