export const indicadoresExecutivos = [
  {
    id: "clientes",
    titulo: "Clientes ativos",
    valor: "18",
    variacao: "+3 no mês",
    tendencia: "positiva",
    icone: "◫",
  },
  {
    id: "mrr",
    titulo: "Receita recorrente",
    valor: "R$ 28.420",
    variacao: "+12,8%",
    tendencia: "positiva",
    icone: "↗",
  },
  {
    id: "contratos",
    titulo: "Contratos vigentes",
    valor: "22",
    variacao: "4 vencem em 60 dias",
    tendencia: "atencao",
    icone: "◇",
  },
  {
    id: "ambientes",
    titulo: "Ambientes online",
    valor: "31",
    variacao: "99,98% disponíveis",
    tendencia: "positiva",
    icone: "●",
  },
  {
    id: "licencas",
    titulo: "Licenças ativas",
    valor: "246",
    variacao: "98,4% regulares",
    tendencia: "positiva",
    icone: "⌘",
  },
  {
    id: "implantacoes",
    titulo: "Implantações",
    valor: "03",
    variacao: "2 dentro do prazo",
    tendencia: "neutra",
    icone: "⚙",
  },
];

export const clientesDemonstrativos = [
  {
    id: "cli-001",
    nome: "Colégio Horizonte",
    segmento: "Educação",
    plano: "Profissional",
    modulos: 7,
    unidades: 3,
    mensalidade: 1290,
    vencimento: "15/09/2026",
    status: "Ativo",
  },
  {
    id: "cli-002",
    nome: "Hotel Serra Azul",
    segmento: "Hotelaria",
    plano: "Enterprise",
    modulos: 9,
    unidades: 2,
    mensalidade: 2480,
    vencimento: "01/10/2026",
    status: "Ativo",
  },
  {
    id: "cli-003",
    nome: "Clínica Vida",
    segmento: "Saúde",
    plano: "Profissional",
    modulos: 6,
    unidades: 1,
    mensalidade: 1890,
    vencimento: "20/09/2026",
    status: "Implantação",
  },
  {
    id: "cli-004",
    nome: "Prefeitura Municipal",
    segmento: "Governamental",
    plano: "Enterprise",
    modulos: 10,
    unidades: 8,
    mensalidade: 4900,
    vencimento: "30/11/2026",
    status: "Ativo",
  },
  {
    id: "cli-005",
    nome: "Restaurante Alameda",
    segmento: "Restaurantes",
    plano: "Essencial",
    modulos: 4,
    unidades: 1,
    mensalidade: 790,
    vencimento: "10/09/2026",
    status: "Atenção",
  },
];

export const planosDemonstrativos = [
  {
    nome: "Essencial",
    preco: 590,
    descricao: "Operação inicial para pequenas organizações.",
    limites: ["1 unidade", "10 usuários", "3 módulos", "5 GB"],
    clientes: 6,
  },
  {
    nome: "Profissional",
    preco: 1290,
    descricao: "Gestão integrada para operações em crescimento.",
    limites: ["5 unidades", "50 usuários", "8 módulos", "30 GB"],
    clientes: 8,
    destaque: true,
  },
  {
    nome: "Enterprise",
    preco: 2490,
    descricao: "Estrutura avançada, multiunidade e personalizada.",
    limites: ["Unidades ampliadas", "Usuários ampliados", "Módulos completos", "100 GB"],
    clientes: 4,
  },
];

export const modulosDemonstrativos = [
  { nome: "Gestão de Clientes", categoria: "Core", preco: 190, contratos: 18 },
  { nome: "Contratos e Licenças", categoria: "Core", preco: 160, contratos: 18 },
  { nome: "Hospedagem Gerenciada", categoria: "Infraestrutura", preco: 220, contratos: 15 },
  { nome: "BI e Indicadores", categoria: "Inteligência", preco: 290, contratos: 12 },
  { nome: "NEXUS Educação", categoria: "Portfólio", preco: 690, contratos: 6 },
  { nome: "NEXUS Hotelaria", categoria: "Portfólio", preco: 790, contratos: 4 },
  { nome: "NEXUS Saúde", categoria: "Portfólio", preco: 890, contratos: 3 },
  { nome: "NEXUS Governamental", categoria: "Portfólio", preco: 990, contratos: 3 },
];

export const alertasOperacionais = [
  {
    titulo: "Contratos próximos do vencimento",
    descricao: "Quatro contratos vencem nos próximos 60 dias.",
    nivel: "atencao",
  },
  {
    titulo: "Implantação Clínica Vida",
    descricao: "Configuração de usuários aguardando validação.",
    nivel: "informacao",
  },
  {
    titulo: "Backup concluído",
    descricao: "Todos os ambientes foram verificados com sucesso.",
    nivel: "sucesso",
  },
  {
    titulo: "Chamados em aberto",
    descricao: "Sete chamados aguardam análise da equipe de suporte.",
    nivel: "atencao",
  },
];

export const evolucaoReceita = [
  { mes: "Mar", valor: 16200 },
  { mes: "Abr", valor: 18400 },
  { mes: "Mai", valor: 19750 },
  { mes: "Jun", valor: 22100 },
  { mes: "Jul", valor: 25180 },
  { mes: "Ago", valor: 28420 },
];
