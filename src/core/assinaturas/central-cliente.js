import { MODULOS_PLENIUM } from "../catalogos/modulos";
import { FACILITIES_PLENIUM } from "../catalogos/facilities";
import { PRODUTOS_PLENIUM } from "../catalogos/produtos";

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
    produtos: (assinatura.produtos || []).map((id) => PRODUTOS_PLENIUM[id]).filter(Boolean),
    modulos: (assinatura.entitlements?.modulos || []).map((id) => MODULOS_PLENIUM[id]).filter(Boolean),
    facilities: (assinatura.entitlements?.facilities || []).map((id) => Object.values(FACILITIES_PLENIUM).find((item) => item.id === id)).filter(Boolean),
    limites: assinatura.entitlements?.limites || {},
  };
}
