export const STATUS_CONFORMIDADE = Object.freeze(["regular", "atencao", "urgente", "vencido", "em-renovacao"]);

export function criarDocumentoConformidade({
  tipo,
  numero = "",
  orgaoEmissor = "",
  emissao = null,
  validade = null,
  responsavelId = null,
  unidadeId = null,
  arquivoId = null,
  alertasDias = [90, 60, 30, 15, 7, 1],
} = {}) {
  if (!tipo) throw new Error("tipo é obrigatório");
  return { tipo, numero, orgaoEmissor, emissao, validade, responsavelId, unidadeId, arquivoId, alertasDias, historico: [] };
}
