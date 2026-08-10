const DESCONTOS_PERMANENCIA = Object.freeze({ 1: 0, 12: 10, 24: 15, 36: 20 });

export function descontoPermanencia(duracaoMeses = 1) {
  return DESCONTOS_PERMANENCIA[duracaoMeses] ?? 0;
}

export function calcularOferta({ precoTabela = 0, duracaoMeses = 1, descontoEcossistema = 0, descontoCampanha = 0, custoEstimado = 0, margemMinimaPercentual = 35 } = {}) {
  const permanencia = descontoPermanencia(duracaoMeses);
  // Descontos são sequenciais, não simplesmente somados.
  let preco = Number(precoTabela) || 0;
  preco *= 1 - permanencia / 100;
  preco *= 1 - Math.max(0, descontoEcossistema) / 100;
  preco *= 1 - Math.max(0, descontoCampanha) / 100;
  const pisoMargem = custoEstimado > 0 ? custoEstimado / (1 - margemMinimaPercentual / 100) : 0;
  const precoFinal = Math.max(preco, pisoMargem);
  return {
    precoTabela,
    precoFinal: Number(precoFinal.toFixed(2)),
    economia: Number(Math.max(0, precoTabela - precoFinal).toFixed(2)),
    descontos: { permanencia, ecossistema: descontoEcossistema, campanha: descontoCampanha },
    margemProtegida: precoFinal >= pisoMargem,
  };
}

export const MODALIDADES_CONTRATO = Object.freeze([
  { meses: 1, nome: "Mensal", descricao: "Flexibilidade mensal" },
  { meses: 12, nome: "Anual", descricao: "Benefício de permanência" },
  { meses: 24, nome: "Bienal", descricao: "Desconto progressivo" },
  { meses: 36, nome: "Trienal", descricao: "Melhor condição de permanência" },
]);
