import { executeMock } from "./providers/mock";
const executors = { mock: executeMock };
export function getProviderExecutor(code) { return executors[code] || null; }
export async function executeProvider(providerCode, payload) {
  const executor = getProviderExecutor(providerCode);
  if (!executor) throw new Error("AI_PROVIDER_NOT_CONFIGURED");
  return executor(payload);
}
