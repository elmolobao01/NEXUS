import { criarEntitlements } from "../assinaturas/entitlements";

export function criarOrganizacao({
  id,
  razaoSocial,
  nomeFantasia,
  documento,
  segmento,
  perfilOperacional,
  logoUrl = null,
  corPrincipal = "#0066ff",
  unidades = [],
  contatos = {},
  configuracoes = {},
  assinatura = null,
} = {}) {
  if (!id || !nomeFantasia || !segmento) throw new Error("Organização requer id, nomeFantasia e segmento.");
  return {
    id, razaoSocial: razaoSocial || nomeFantasia, nomeFantasia, documento: documento || null,
    segmento, perfilOperacional: perfilOperacional || null, logoUrl, corPrincipal,
    unidades: [...unidades], contatos: { ...contatos }, configuracoes: { ...configuracoes },
    assinatura,
  };
}

export const ORGANIZACAO_DEMO = criarOrganizacao({
  id: "org-demo",
  razaoSocial: "Organização Demonstrativa NEXUS Ltda.",
  nomeFantasia: "Minha Organização",
  documento: "00.000.000/0001-00",
  segmento: "educacao",
  perfilOperacional: "multi-etapas",
  unidades: [{ id: "unidade-matriz", nome: "Unidade Matriz", principal: true }],
  contatos: { email: "administracao@organizacao.com.br", telefone: "(71) 99999-0000" },
  assinatura: {
    id: "ass-demo",
    status: "ativa",
    produtoPrincipal: "gestao",
    plano: "Profissional",
    modalidade: "anual",
    duracaoMeses: 12,
    renovacaoEm: "2027-08-10",
    valorTabela: 699,
    valorMensal: 594.15,
    descontoPermanenciaPercentual: 10,
    descontoEcossistemaPercentual: 5,
    economiaMensal: 104.85,
    produtos: ["gestao"],
    entitlements: criarEntitlements({
      modulos: ["financeiro", "documentos", "workflow"],
      facilities: ["portal"],
      capacidades: ["usuarios", "unidades", "conformidade"],
      limites: { usuarios: 25, unidades: 2, armazenamentoGb: 20 },
    }),
  },
});
