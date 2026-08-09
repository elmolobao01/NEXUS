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
            <div><strong>Qual é o seu segmento?</strong><small>Mostramos a configuração NEXUS mais adequada para a sua operação.</small></div>
          </div>

          <div className="segment-grid" role="radiogroup" aria-label="Segmento do negócio">
            {Object.entries(segmentos).map(([key, item]) => (
              <button key={key} type="button" className={`segment-option ${segmento === key ? "active" : ""}`} onClick={() => setSegmento(key)} aria-pressed={segmento === key}>
                <strong>{item.nome}</strong>
                <span>{item.subtitulo}</span>
              </button>
            ))}
          </div>

          <section className="segment-solution-card">
            <div className="segment-solution-head">
              <span>SOLUÇÃO PARA O SEU NEGÓCIO</span>
              <h3>{segmentoAtual.subtitulo}</h3>
              <p>{segmentoAtual.descricao}</p>
            </div>
            <div className="segment-resource-grid">
              {segmentoAtual.recursos.map((recurso) => <span key={recurso}>✓ {recurso}</span>)}
            </div>
            <div className="segment-free-row">
              <b>IMPLANTAÇÃO GRÁTIS</b>
              <span>Formação técnica inclusa</span>
              <span>Suporte técnico incluso</span>
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
