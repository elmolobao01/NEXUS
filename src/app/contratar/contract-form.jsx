"use client";

import { useMemo, useState } from "react";

const WHATSAPP = "5571999952478";

const productLabels = {
  gestao: "NEXUS Gestão",
  ia: "NEXUS IA",
  combo: "NEXUS Gestão + NEXUS IA",
};

const segmentos = {
  educacao: {
    nome: "Educação",
    subtitulo: "NEXUS Educação",
    descricao: "Gestão acadêmica, administrativa e de relacionamento em uma única estrutura.",
    recursos: [
      "Cadastro de alunos e responsáveis",
      "Professores, turmas e componentes curriculares",
      "Frequência, avaliações e notas",
      "Boletins e acompanhamento acadêmico",
      "Calendário, atividades e comunicação",
      "Relatórios e indicadores educacionais",
    ],
    facilities: [
      "Portal do aluno e do responsável",
      "Boletins, notas e frequência online",
      "Alertas e comunicados via WhatsApp",
      "Calendário escolar e avisos digitais",
      "Solicitações e envio de documentos online",
      "Confirmação de leitura de comunicados",
    ],
  },
  saude: {
    nome: "Saúde e Clínicas",
    subtitulo: "NEXUS Saúde",
    descricao: "Organização de atendimentos, agenda, equipe e indicadores para clínicas e serviços de saúde.",
    recursos: [
      "Cadastro de pacientes e contatos",
      "Agenda e organização de atendimentos",
      "Gestão de equipe e responsáveis",
      "Documentos e registros operacionais",
      "Indicadores de atendimento",
      "Estrutura preparada para controles de privacidade",
    ],
    facilities: [
      "Portal do paciente",
      "Agendamento online",
      "Confirmações e lembretes via WhatsApp",
      "Lista de espera e encaixes organizados",
      "Envio de orientações e documentos",
      "Pesquisa de satisfação pós-atendimento",
    ],
  },
  restaurantes: {
    nome: "Restaurantes e Alimentação",
    subtitulo: "NEXUS Restaurantes",
    descricao: "Controle operacional para restaurantes, bares, lanchonetes e negócios de alimentação.",
    recursos: [
      "Mesas, comandas e pedidos",
      "Reservas e atendimento",
      "Cadastro e relacionamento com clientes",
      "Rotinas operacionais e equipe",
      "Indicadores de movimento e desempenho",
      "Gestão centralizada da operação",
    ],
    facilities: [
      "Cardápio digital",
      "Reservas e fila de espera online",
      "Confirmações e atendimento via WhatsApp",
      "Pedidos para retirada ou delivery, quando aplicável",
      "Relacionamento e campanhas para clientes",
      "Pesquisa de satisfação",
    ],
  },
  comercio: {
    nome: "Comércio",
    subtitulo: "NEXUS Comércio",
    descricao: "Organize clientes, operação comercial, equipe e indicadores do seu negócio.",
    recursos: [
      "Cadastro e relacionamento com clientes",
      "Produtos e organização comercial",
      "Acompanhamento de oportunidades",
      "Gestão de equipe e responsáveis",
      "Indicadores e relatórios",
      "Visão gerencial da operação",
    ],
    facilities: [
      "Vitrine ou catálogo digital",
      "Solicitação de orçamento online",
      "Atendimento e relacionamento via WhatsApp",
      "Acompanhamento de pedidos e solicitações",
      "Campanhas de relacionamento",
      "Pesquisa de satisfação",
    ],
  },
  servicos: {
    nome: "Serviços e Escritórios",
    subtitulo: "NEXUS Serviços",
    descricao: "Estruture demandas, prazos, documentos e relacionamento com clientes.",
    recursos: [
      "Clientes e responsáveis",
      "Demandas, processos e tarefas",
      "Prazos e acompanhamento",
      "Documentos e histórico",
      "Equipe e atribuições",
      "Indicadores de produtividade",
    ],
    facilities: [
      "Portal do cliente",
      "Agendamento online",
      "Abertura e acompanhamento de solicitações",
      "Envio e recebimento de documentos",
      "Avisos automáticos via WhatsApp",
      "Aprovação de etapas e orçamentos",
    ],
  },
  hotelaria: {
    nome: "Hotelaria e Pousadas",
    subtitulo: "NEXUS Hotelaria",
    descricao: "Gestão de hóspedes, reservas, atendimento e rotinas de hospedagem.",
    recursos: [
      "Cadastro de hóspedes",
      "Reservas e acompanhamento",
      "Atendimento e solicitações",
      "Serviços e rotina operacional",
      "Equipe e responsáveis",
      "Indicadores de ocupação e atendimento",
    ],
    facilities: [
      "Site próprio com reservas",
      "Consulta de disponibilidade e pré-reserva",
      "Confirmações e comunicação via WhatsApp",
      "Check-in digital",
      "Solicitação de serviços durante a estadia",
      "Pesquisa pós-check-out",
    ],
  },
  juridico: {
    nome: "Jurídico",
    subtitulo: "NEXUS Jurídico",
    descricao: "Gestão organizada de clientes, demandas, documentos, prazos e equipe jurídica.",
    recursos: [
      "Cadastro de clientes e partes relacionadas",
      "Demandas, processos e tarefas",
      "Agenda, compromissos e prazos",
      "Documentos e histórico de atendimentos",
      "Responsáveis e distribuição de atividades",
      "Indicadores de produtividade e carteira",
    ],
    facilities: [
      "Portal do cliente",
      "Acompanhamento interno das demandas",
      "Compartilhamento seguro de documentos",
      "Lembretes e atualizações via WhatsApp",
      "Solicitações e envio de informações online",
      "Aceites e assinaturas eletrônicas quando integrados",
    ],
  },
  imobiliario: {
    nome: "Imobiliário",
    subtitulo: "NEXUS Imobiliário",
    descricao: "Gestão comercial e operacional para imobiliárias, corretores e administradores de imóveis.",
    recursos: [
      "Cadastro de imóveis e proprietários",
      "Interessados, leads e funil comercial",
      "Visitas, propostas e negociações",
      "Contratos, locações e documentos",
      "Equipe e responsáveis",
      "Indicadores de carteira e conversão",
    ],
    facilities: [
      "Site ou vitrine de imóveis",
      "Busca por filtros e página individual do imóvel",
      "Formulário de interesse",
      "Agendamento de visitas",
      "Atendimento via WhatsApp",
      "Portal do proprietário, interessado ou locatário",
    ],
  },
  governamental: {
    nome: "Governamental e Institucional",
    subtitulo: "NEXUS Governamental",
    descricao: "Gestão de processos, solicitações, prazos e rastreabilidade para organizações públicas e institucionais.",
    recursos: [
      "Processos e solicitações",
      "Fluxos e etapas operacionais",
      "Prazos e responsáveis",
      "Documentos e histórico de ações",
      "Indicadores e painéis gerenciais",
      "Rastreabilidade e governança",
    ],
    facilities: [
      "Portal de serviços e acompanhamento",
      "Abertura de solicitações e protocolo digital",
      "Consulta de andamento",
      "Envio de documentos online",
      "Notificações e comunicação institucional",
      "Pesquisas de satisfação e painéis públicos quando cabíveis",
    ],
  },
  outros: {
    nome: "Outros segmentos",
    subtitulo: "NEXUS sob medida",
    descricao: "Uma configuração modular construída a partir da rotina e das necessidades do seu negócio.",
    recursos: [
      "Mapeamento inicial da operação",
      "Módulos adequados à sua realidade",
      "Clientes, processos e equipe",
      "Indicadores e relatórios",
      "Automação de rotinas",
      "Evolução modular conforme o crescimento",
    ],
    facilities: [
      "Portal externo personalizado",
      "Site institucional ou comercial",
      "Agenda e formulários online",
      "Solicitações e documentos digitais",
      "Notificações e WhatsApp",
      "Automações configuradas conforme a operação",
    ],
  },
};

const usosIA = {
  profissional: "Uso profissional individual",
  equipe: "Empresa ou equipe",
  conhecimento: "Base de conhecimento empresarial",
  conteudo: "Conteúdo, imagem e produtividade",
  geral: "Uso geral / ainda não defini",
};

export default function ContractForm({ initialProduct = "gestao", origem = "site" }) {
  const [produto, setProduto] = useState(initialProduct);
  const [segmento, setSegmento] = useState("educacao");
  const [usoIA, setUsoIA] = useState("profissional");
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  const temGestao = produto === "gestao" || produto === "combo";
  const temIA = produto === "ia" || produto === "combo";
  const segmentoAtual = segmentos[segmento];

  const whatsappHref = useMemo(() => {
    const msg = [
      "Olá! Quero conhecer os planos e iniciar uma contratação NEXUS.",
      `Produto: ${productLabels[produto]}`,
      temGestao ? `Segmento: ${segmentoAtual.nome}` : null,
      temIA ? `Uso principal da IA: ${usosIA[usoIA]}` : null,
      `Nome: ${nome || "não informado"}`,
      `Empresa: ${empresa || "não informada"}`,
      `E-mail: ${email || "não informado"}`,
      `Telefone: ${telefone || "não informado"}`,
      origem === "cliente" ? "Origem: cliente NEXUS existente / adicionar produto" : "Origem: site público",
    ].filter(Boolean).join("\n");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }, [produto, segmentoAtual, usoIA, nome, empresa, email, telefone, origem, temGestao, temIA]);

  return (
    <form className="contract-form contract-form-segmented" onSubmit={(event) => { event.preventDefault(); window.open(whatsappHref, "_blank", "noopener,noreferrer"); }}>
      <div className="contract-step">
        <span className="contract-step-number">01</span>
        <div><strong>Escolha o produto</strong><small>Você pode contratar cada solução separadamente ou combinar Gestão + IA.</small></div>
      </div>

      <label><span>Produto de interesse</span><select value={produto} onChange={(e) => setProduto(e.target.value)}><option value="gestao">NEXUS Gestão</option><option value="ia">NEXUS IA</option><option value="combo">Gestão + IA</option></select></label>

      {temGestao && (
        <>
          <div className="contract-step">
            <span className="contract-step-number">02</span>
            <div><strong>Qual é o seu segmento?</strong><small>Selecione o perfil mais próximo da sua operação. A configuração final é personalizada.</small></div>
          </div>

          <label className="segment-select-label">
            <span>Segmento do negócio</span>
            <select value={segmento} onChange={(e) => setSegmento(e.target.value)}>
              {Object.entries(segmentos).map(([key, item]) => <option key={key} value={key}>{item.nome}</option>)}
            </select>
          </label>

          <section className="segment-solution-card">
            <div className="segment-solution-head">
              <span>SOLUÇÃO PARA O SEU NEGÓCIO</span>
              <h3>{segmentoAtual.subtitulo}</h3>
              <p>{segmentoAtual.descricao}</p>
            </div>

            <div className="segment-tailored-note">
              <strong>NEXUS sob medida para a sua estrutura</strong>
              <span>Cada implantação é configurada conforme o porte, os processos, a rotina e as necessidades da empresa. Você contrata os recursos adequados à sua operação e amplia a solução conforme o negócio evolui.</span>
            </div>

            <div className="segment-section-title">RECURSOS DE GESTÃO</div>
            <div className="segment-resource-grid">
              {segmentoAtual.recursos.map((recurso) => <span key={recurso}>✓ {recurso}</span>)}
            </div>

            <div className="segment-section-title facilities-title">FACILITIES NEXUS</div>
            <div className="segment-facilities-grid">
              {segmentoAtual.facilities.map((facility) => <span key={facility}>★ {facility}</span>)}
            </div>
          </section>
        </>
      )}

      {temIA && (
        <>
          <div className="contract-step">
            <span className="contract-step-number">{temGestao ? "03" : "02"}</span>
            <div><strong>Como pretende utilizar a IA?</strong><small>Essa informação ajuda a indicar o plano e os recursos mais adequados.</small></div>
          </div>
          <label><span>Perfil de uso do NEXUS IA</span><select value={usoIA} onChange={(e) => setUsoIA(e.target.value)}>{Object.entries(usosIA).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <div className="ia-summary-card">
            <strong>NEXUS IA</strong>
            <span>Multi-IA • NEXUS Knowledge • Acesso inteligente às principais IAs</span>
          </div>
        </>
      )}

      <div className="contract-step">
        <span className="contract-step-number">{produto === "combo" ? "04" : "03"}</span>
        <div><strong>Seus dados</strong><small>Usaremos essas informações para apresentar os planos e condições adequados ao seu perfil.</small></div>
      </div>

      <div className="contract-grid">
        <label><span>Nome</span><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" required /></label>
        <label><span>Empresa</span><input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Empresa ou organização" /></label>
        <label><span>E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com.br" required /></label>
        <label><span>WhatsApp</span><input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(71) 99999-9999" required /></label>
      </div>

      <button type="submit" className="home-primary-button contract-submit">Ver planos e continuar</button>
      <small>A contratação é concluída após a escolha do plano. O atendimento NEXUS receberá sua solicitação já contextualizada.</small>
    </form>
  );
}
