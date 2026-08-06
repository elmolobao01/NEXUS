export const metricasRoot = [
  {
    id: "clientes",
    titulo: "Clientes ativos",
    valor: "158",
    complemento: "+14 neste trimestre",
    tipo: "positivo",
    icone: "◫",
  },
  {
    id: "mrr",
    titulo: "Receita mensal",
    valor: "R$ 84.250",
    complemento: "MRR consolidado",
    tipo: "positivo",
    icone: "↗",
  },
  {
    id: "arr",
    titulo: "Receita anual",
    valor: "R$ 1.011.000",
    complemento: "ARR projetado",
    tipo: "positivo",
    icone: "◇",
  },
  {
    id: "contratos",
    titulo: "Novos contratos",
    valor: "14",
    complemento: "2 aguardando assinatura",
    tipo: "neutro",
    icone: "⌘",
  },
  {
    id: "cancelamentos",
    titulo: "Cancelamentos",
    valor: "02",
    complemento: "1,27% da carteira",
    tipo: "atencao",
    icone: "×",
  },
  {
    id: "renovacao",
    titulo: "Taxa de renovação",
    valor: "97%",
    complemento: "+1,8 p.p.",
    tipo: "positivo",
    icone: "✓",
  },
];

export const receitaMensal = [
  { mes: "Mar", valor: 55200 },
  { mes: "Abr", valor: 61100 },
  { mes: "Mai", valor: 64850 },
  { mes: "Jun", valor: 71900 },
  { mes: "Jul", valor: 78100 },
  { mes: "Ago", valor: 84250 },
];

export const segmentos = [
  { nome: "Governamental", clientes: 32, receita: 24200, cor: "governo" },
  { nome: "Educação", clientes: 48, receita: 21800, cor: "educacao" },
  { nome: "Saúde", clientes: 27, receita: 16400, cor: "saude" },
  { nome: "Hotelaria", clientes: 21, receita: 12850, cor: "hotelaria" },
  { nome: "Restaurantes", clientes: 30, receita: 9000, cor: "restaurantes" },
];

export const ultimosClientes = [
  {
    nome: "Instituto Nova Geração",
    segmento: "Educação",
    plano: "Profissional",
    valor: 1490,
    criadoEm: "05/08/2026",
    status: "Implantação",
  },
  {
    nome: "Hotel Imperial",
    segmento: "Hotelaria",
    plano: "Enterprise",
    valor: 2890,
    criadoEm: "04/08/2026",
    status: "Ativo",
  },
  {
    nome: "Clínica Integra",
    segmento: "Saúde",
    plano: "Profissional",
    valor: 1990,
    criadoEm: "03/08/2026",
    status: "Ativo",
  },
  {
    nome: "Prefeitura de Santa Luz",
    segmento: "Governamental",
    plano: "Enterprise",
    valor: 5490,
    criadoEm: "01/08/2026",
    status: "Homologação",
  },
];

export const modulosMaisVendidos = [
  { nome: "BI e Indicadores", vendas: 96, percentual: 82 },
  { nome: "Hospedagem Gerenciada", vendas: 88, percentual: 75 },
  { nome: "Contratos e Licenças", vendas: 81, percentual: 69 },
  { nome: "Gestão de Usuários", vendas: 73, percentual: 62 },
  { nome: "Auditoria e Logs", vendas: 65, percentual: 55 },
];

export const alertasRoot = [
  {
    titulo: "Contrato vence amanhã",
    descricao: "Restaurante Alameda precisa de renovação.",
    nivel: "critico",
  },
  {
    titulo: "Cliente inadimplente",
    descricao: "Duas cobranças estão vencidas há mais de 10 dias.",
    nivel: "atencao",
  },
  {
    titulo: "Hospedagem acima do limite",
    descricao: "Colégio Horizonte atingiu 92% do armazenamento.",
    nivel: "atencao",
  },
  {
    titulo: "Backup verificado",
    descricao: "Todos os ambientes críticos foram validados.",
    nivel: "sucesso",
  },
];

export const navegacaoRoot = [
  "Visão executiva",
  "Clientes",
  "Contratos",
  "Planos e módulos",
  "Financeiro",
  "Hospedagem",
  "Implantações",
  "Suporte",
  "Auditoria",
  "Configurações",
];
