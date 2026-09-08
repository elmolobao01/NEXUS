export function estimateTokenCost({ inputTokens = 0, outputTokens = 0, inputCostPerMillion = 0, outputCostPerMillion = 0 }) {
  return (Number(inputTokens) / 1_000_000) * Number(inputCostPerMillion) + (Number(outputTokens) / 1_000_000) * Number(outputCostPerMillion);
}
