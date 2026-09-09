import { executeMock } from "./providers/mock";
import { executeGoogle } from "./providers/google";
import { executeDeepSeek } from "./providers/deepseek";

const executors = { mock: executeMock, google: executeGoogle, deepseek: executeDeepSeek };
export function getProviderExecutor(code) { return executors[code] || null; }
export async function executeProvider(providerCode, payload) {
  const executor = getProviderExecutor(providerCode);
  if (!executor) throw new Error("AI_PROVIDER_NOT_CONFIGURED");
  return executor(payload);
}
