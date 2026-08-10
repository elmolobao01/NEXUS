/**
 * Entitlements desacoplam plano comercial de código funcional.
 * O módulo pergunta "a organização possui a capacidade X?" e nunca
 * "a organização está no plano Y?".
 */
export function criarEntitlements({ modulos = [], facilities = [], capacidades = [], limites = {} } = {}) {
  return Object.freeze({
    modulos: [...new Set(modulos)],
    facilities: [...new Set(facilities)],
    capacidades: [...new Set(capacidades)],
    limites: { ...limites },
  });
}

export function possuiModulo(entitlements, moduloId) {
  return Boolean(entitlements?.modulos?.includes(moduloId));
}

export function possuiFacility(entitlements, facilityId) {
  return Boolean(entitlements?.facilities?.includes(facilityId));
}

export function obterLimite(entitlements, chave, fallback = null) {
  return entitlements?.limites?.[chave] ?? fallback;
}
