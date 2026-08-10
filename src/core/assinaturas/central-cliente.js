import { MODULOS_NEXUS } from "../catalogos/modulos";
import { FACILITIES_NEXUS } from "../catalogos/facilities";
import { PRODUTOS_NEXUS } from "../catalogos/produtos";

export function resumoCentral(organizacao) {
  const assinatura = organizacao?.assinatura || {};
  return {
    plano: assinatura.plano || "Sem plano",
    status: assinatura.status || "inativa",
    modalidade: assinatura.modalidade || "mensal",
    duracaoMeses: assinatura.duracaoMeses || 1,
    renovacaoEm: assinatura.renovacaoEm || null,
    valorMensal: assinatura.valorMensal || 0,
    economiaMensal: assinatura.economiaMensal || 0,
    produtos: (assinatura.produtos || []).map((id) => PRODUTOS_NEXUS[id]).filter(Boolean),
    modulos: (assinatura.entitlements?.modulos || []).map((id) => MODULOS_NEXUS[id]).filter(Boolean),
    facilities: (assinatura.entitlements?.facilities || []).map((id) => Object.values(FACILITIES_NEXUS).find((item) => item.id === id)).filter(Boolean),
    limites: assinatura.entitlements?.limites || {},
  };
}
