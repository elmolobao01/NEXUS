export const PRODUTOS_NEXUS = Object.freeze({
  gestao: {
    id: "gestao",
    nome: "NEXUS Gestão",
    independente: true,
    componentes: ["core", "segmento", "modulos", "facilities", "conformidade"],
  },
  ia: {
    id: "ia",
    nome: "NEXUS IA",
    independente: true,
    componentes: ["multi-ia", "knowledge", "assistentes", "automacoes-ia"],
    custoVariavel: true,
  },
});
