// Public commercial arguments. Benefits are potential outcomes, not guarantees.
const benefits={
 HOTELARIA:['Organizar reservas e disponibilidade para reduzir conflitos de hospedagem.','Usar tarifas sazonais e pacotes promocionais para apoiar a ocupação.'],
 GESTAO:['Acompanhar receitas, despesas e fluxo de caixa para identificar oportunidades de economia.'],
 CHATBOT:['Automatizar perguntas frequentes no WhatsApp para reduzir a demora no atendimento.','Usar interpretação contextual e base de conhecimento para apoiar respostas mais relevantes.'],
 IA:['Apoiar a produção de textos, resumos e comunicações, reduzindo tarefas administrativas repetitivas.'],
 WEBSITE:['Apresentar produtos e serviços e facilitar o contato de potenciais clientes.'],
 SAUDE:['Organizar agendas e registros de atendimento para facilitar a rotina da equipe.'],
 RESTAURANTE:['Organizar pedidos, comandas e vendas para reduzir falhas operacionais.'],
 DELIVERY:['Acompanhar pedidos e entregas para melhorar a organização do atendimento.'],
 EDUCACAO:['Organizar matrículas, registros escolares e comunicações com responsáveis.'],
 JURIDICO:['Organizar processos, documentos e prazos para apoiar o acompanhamento das demandas.'],
 IMOBILIARIO:['Organizar imóveis, visitas e contratos para facilitar o acompanhamento comercial.'],
 VAREJO:['Acompanhar vendas e estoque para apoiar decisões de reposição.'],
 PET:['Organizar agendamentos e histórico de serviços para facilitar o atendimento.'],
 PROFISSAO:['Organizar agenda, clientes e recebimentos para facilitar a rotina profissional.'],
 ECOMMERCE:['Organizar catálogo, pedidos e vendas para apoiar a operação digital.']
};
export function benefitFor(o){const b=benefits[o.family]||[];return b.slice(0,(o.index??0)+1).join(' ');}
export function commercialConcern(q){
 if(/\b(concorrente|concorrencia|outra empresa|outro sistema)\b/.test(q))return 'competition';
 if(/\b(nao sei se preciso|nao tenho certeza|preciso mesmo|necessidade de contratar)\b/.test(q))return 'necessity';
 if(/\b(agora nao|mais tarde|depois eu vejo|nao e o momento)\b/.test(q))return 'timing';
 if(/^(?:minha prioridade e |quero priorizar |prioridade )?(?:reduzir custos|melhorar o atendimento|ampliar as vendas|aumentar as vendas)$/.test(q))return 'priority';
 if(/\b(caro|cara|elevado|elevada|muito alto|muito alta|orcamento|reduzir (?:os |meus )?custos|melhorar (?:meu |o )?faturamento|aumentar (?:meu |o )?faturamento|vantagens de contratar|vale a pena)\b/.test(q))return 'value';
 return null;
}
export function concernIntro(c){return ({competition:'Vale comparar os recursos, limites e condições de cada solução, sem presumir características de outros fornecedores.',necessity:'Podemos avaliar quais soluções realmente atendem às suas necessidades antes de decidir.',timing:'Você pode avaliar a contratação no momento adequado, sem compromisso de alterar sua proposta.',priority:'Vamos orientar a escolha conforme sua prioridade.',value:'Entendo sua preocupação com o investimento. Cada solução deve contribuir para sua operação.'})[c]||'';}
