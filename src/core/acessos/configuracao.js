export const ambientesNexus = {
  admin: {
    nome: "Administração NEXUS",
    descricao: "Gestão interna da plataforma, clientes, contratos, planos e infraestrutura.",
    rota: "/admin",
  },
  cliente: {
    nome: "Portal do Cliente",
    descricao: "Ambiente operacional isolado por organização, unidade, portfólio e perfil.",
    rota: "/portal",
  },
};

export const organizacoesDemo = [
  {
    id: "org-educacao",
    nome: "Colégio Horizonte",
    portfolio: "educacao",
    unidade: "Unidade Centro",
    perfil: "Direção Geral",
    modulos: ["Visão geral", "Alunos", "Professores", "Turmas", "Frequência", "Avaliações", "Portal da Família", "Relatórios"],
  },
  {
    id: "org-saude",
    nome: "Clínica Vida Plena",
    portfolio: "saude",
    unidade: "Matriz",
    perfil: "Administrador Clínico",
    modulos: ["Visão geral", "Pacientes", "Agenda", "Atendimentos", "Profissionais", "Faturamento", "Relatórios"],
  },
  {
    id: "org-hotelaria",
    nome: "Hotel Serra Azul",
    portfolio: "hotelaria",
    unidade: "Unidade Centro",
    perfil: "Gerente Geral",
    modulos: ["Visão geral", "Reservas", "Hóspedes", "Acomodações", "Recepção", "Governança", "Financeiro", "Relatórios"],
  },
  {
    id: "org-restaurantes",
    nome: "Bistrô NEXUS",
    portfolio: "restaurantes",
    unidade: "Loja Principal",
    perfil: "Gestor Operacional",
    modulos: ["Visão geral", "Mesas", "Pedidos", "Cozinha", "Delivery", "Estoque", "Financeiro", "Relatórios"],
  },
  {
    id: "org-governo",
    nome: "Prefeitura Digital",
    portfolio: "governamental",
    unidade: "Administração Central",
    perfil: "Gestor Institucional",
    modulos: ["Visão geral", "Processos", "Protocolos", "Atendimentos", "Indicadores", "Prazos", "Auditoria", "Relatórios"],
  },
];

export const indicadoresPorPortfolio = {
  educacao: [
    ["Alunos ativos", "1.248", "+3,2% no período"],
    ["Frequência média", "92,4%", "+2,7% no período"],
    ["Turmas", "42", "Ano letivo atual"],
    ["Avaliações", "156", "Agenda pedagógica"],
  ],
  saude: [
    ["Pacientes ativos", "3.840", "+4,1% no período"],
    ["Consultas hoje", "86", "12 em andamento"],
    ["Profissionais", "54", "Equipe cadastrada"],
    ["Tempo médio", "18 min", "Atendimento inicial"],
  ],
  hotelaria: [
    ["Ocupação", "78%", "+6% nesta semana"],
    ["Reservas", "64", "Próximos 30 dias"],
    ["Check-ins hoje", "18", "7 já realizados"],
    ["Diária média", "R$ 428", "+4,8% no mês"],
  ],
  restaurantes: [
    ["Pedidos hoje", "184", "+11% no período"],
    ["Mesas ocupadas", "18/26", "69% de ocupação"],
    ["Ticket médio", "R$ 86", "+5,4% no mês"],
    ["Delivery", "42", "Pedidos em andamento"],
  ],
  governamental: [
    ["Processos ativos", "2.418", "+3,6% no período"],
    ["Dentro do prazo", "91%", "+4,2% no mês"],
    ["Atendimentos", "384", "Últimos 30 dias"],
    ["Unidades", "12", "Escopo institucional"],
  ],
};
