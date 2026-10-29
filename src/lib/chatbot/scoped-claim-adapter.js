// Explicit tenant + phone scoping; no network access on import.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createScopedClaimBatch({ rpc, organizationId, phoneNumberId }) {
  if (typeof rpc !== 'function' || !UUID.test(organizationId || '') ||
      !/^\d{5,30}$/.test(phoneNumberId || '')) {
    throw new Error('invalid_scoped_claim_configuration');
  }
  return async function claimBatch(limit = 1) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new Error('invalid_scoped_claim_limit');
    const rows = await rpc('nexus_chatbot_inbound_claim_scoped', {
      p_organization_id: organizationId,
      p_phone_number_id: phoneNumberId,
      p_limit: limit,
    });
    if (!Array.isArray(rows) || rows.length > limit) throw new Error('invalid_scoped_claim_response');
    if (rows.some(row => row?.organization_id !== organizationId))
      throw new Error('scoped_claim_tenant_mismatch_requires_reconciliation');
    return rows;
  };
}
