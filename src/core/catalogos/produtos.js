export const PRODUTOS_PLENIUM = Object.freeze({
  gestao: {
    id: "gestao",
    nome: "PLENIUM Gestão",
    independente: true,
    componentes: ["core", "segmento", "modulos", "facilities", "conformidade"],
  },
  ia: {
    id: "ia",
    nome: "PLENIUM IA",
    independente: true,
    componentes: ["multi-ia", "knowledge", "assistentes", "automacoes-ia"],
    custoVariavel: true,
  },
});
