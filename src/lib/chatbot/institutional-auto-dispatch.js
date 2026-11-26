// Independent opt-in, restricted to the already validated institutional scope.
export function automaticDispatchAllowed(env, records, inserted) {
  return env.CHATBOT_INSTITUTIONAL_AUTO_ENABLED === 'true' &&
    env.CHATBOT_PILOT_EXECUTION_ENABLED === 'true' &&
    env.CHATBOT_PILOT_FINANCIAL_MUTATIONS_APPROVED === 'true' &&
    env.CHATBOT_PILOT_META_SENDS_APPROVED === 'true' &&
    env.CHATBOT_PILOT_ORGANIZATION_ID === '11de735a-4dfb-4b8d-b817-bda83d6df03a' &&
    env.CHATBOT_PILOT_PHONE_NUMBER_ID === '1453993444467017' &&
    env.CHATBOT_INBOUND_QUEUE_ADMISSION_ENABLED === 'true' &&
    env.CHATBOT_INBOUND_ADMISSION_ALLOWED_PHONE_IDS?.split(',').map(x=>x.trim()).includes('1453993444467017') &&
    Number.isInteger(inserted) && inserted > 0 && records.length > 0 &&
    records.every(r => r.organization_id === env.CHATBOT_PILOT_ORGANIZATION_ID && r.phone_number_id === env.CHATBOT_PILOT_PHONE_NUMBER_ID);
}

// Bounded work after acknowledgement. Never retry an ambiguous send.
export async function dispatchInstitutionalJobs({run, inserted, log, now = Date.now}) {
  const started = now();
  for (let i = 0; i < Math.min(inserted, 3); i++) {
    if (now() - started >= 35000) break;
    const result = await run();
    const body = result.body;
    log({status:result.status, claimed:body.claimed ?? 0,
      states:(body.results || []).map(r=>({state:r.state,outcome:r.outcome}))});
    if (result.status !== 200 || body.claimed !== 1 || body.results?.length !== 1) break;
    const job = body.results[0];
    if (job.state === 'requires_reconciliation' || job.outcome === 'uncertain') break;
  }
}
