// Explicitly read-only composition. Never creates claim/reserve/send adapters.
// Used to wire the existing production reader to a controlled executor integration.
import { createTransactionalProductionReader } from './transactional-production-adapters';

export function createReadOnlyChatbotComposition(options = {}) {
  const reader = createTransactionalProductionReader(options);
  return Object.freeze({
    loadJob: reader.loadJob,
    revalidate: reader.revalidate,
    selectReply: reader.selectReply,
    execution_enabled: false,
    wallet_mutation_enabled: false,
    meta_send_enabled: false,
  });
}
