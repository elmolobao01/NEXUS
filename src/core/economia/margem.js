export function calcularMargemCliente({ receitaMensal = 0, custosFixosAlocados = 0, custosVariaveis = 0 } = {}) {
  const custoTotal = Number(custosFixosAlocados) + Number(custosVariaveis);
  const receita = Number(receitaMensal);
  const margemBruta = receita - custoTotal;
  const margemPercentual = receita > 0 ? (margemBruta / receita) * 100 : 0;
  return { receita, custoTotal, margemBruta, margemPercentual };
}

export const CATEGORIAS_CUSTO_VARIAVEL = Object.freeze([
  "ia",
  "whatsapp",
  "pagamentos",
  "cobrancas",
  "monitoramento",
  "email",
  "armazenamento-excedente",
]);
