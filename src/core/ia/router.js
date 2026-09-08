import { executeMock } from "./providers/mock";
import { executeGoogle } from "./providers/google";

const executors = { mock: executeMock, google: executeGoogle };
export function getProviderExecutor(code) { return executors[code] || null; }
export async function executeProvider(providerCode, payload) {
  const executor = getProviderExecutor(providerCode);
  if (!executor) throw new Error("AI_PROVIDER_NOT_CONFIGURED");
  return executor(payload);
}
