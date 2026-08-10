export const MODULOS_NEXUS = Object.freeze({
  financeiro: { id: "financeiro", nome: "Financeiro", custoVariavel: false, recursos: ["contas-a-pagar", "contas-a-receber", "despesas-recorrentes", "fluxo-de-caixa", "centros-de-custo", "indicadores"] },
  estoque: { id: "estoque", nome: "Estoque", custoVariavel: false, recursos: ["itens", "fornecedores", "entradas", "saidas", "lotes", "validade", "estoque-minimo"] },
  crm: { id: "crm", nome: "CRM", custoVariavel: false, recursos: ["leads", "clientes", "oportunidades", "historico", "relacionamento"] },
  agenda: { id: "agenda", nome: "Agenda", custoVariavel: false, recursos: ["agendamentos", "profissionais", "recursos", "disponibilidade"] },
  contratos: { id: "contratos", nome: "Contratos", custoVariavel: false, recursos: ["vigencia", "valores", "documentos", "responsaveis", "alertas"] },
  documentos: { id: "documentos", nome: "Documentos", custoVariavel: false, recursos: ["arquivos", "classificacao", "versoes", "validade", "historico"] },
  workflow: { id: "workflow", nome: "Processos e Workflow", custoVariavel: false, recursos: ["etapas", "responsaveis", "prazos", "regras", "automacoes"] },
  vendas: { id: "vendas", nome: "Vendas e Pedidos", custoVariavel: false, recursos: ["produtos", "servicos", "pedidos", "acompanhamento"] },
  alimentacao: { id: "alimentacao", nome: "Alimentação", custoVariavel: false, recursos: ["cardapio", "consumos", "comandas", "producao"] },
});
