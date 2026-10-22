import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade | PLENIUM",
  description: "Saiba como a PLENIUM trata dados pessoais em suas soluções de gestão, integração e atendimento digital.",
  robots: { index: true, follow: true },
};

const sections = [
  { title: "1. Quem somos e a quem se aplica", paragraphs: [
    "A PLENIUM oferece soluções digitais de gestão empresarial, inteligência artificial, integração e atendimento, incluindo o ecossistema NEXUS e recursos de comunicação por WhatsApp Business. Esta política descreve o tratamento de dados pessoais realizado no website, no cadastro comercial e no uso de nossos serviços.",
    "Dependendo da atividade, a PLENIUM atua como controladora dos dados relacionados à sua própria operação e como operadora quando processa dados pessoais em nome de empresas clientes, conforme as instruções e contratos aplicáveis. As empresas clientes podem atuar como controladoras dos dados de seus usuários e contatos."
  ] },
  { title: "2. Quais dados podem ser tratados", paragraphs: [
    "Conforme o serviço utilizado, podemos tratar nome, dados de contato, identificação e informações cadastrais de empresas e representantes, dados de acesso e autenticação, registros de suporte, dados técnicos de uso e informações necessárias à prestação dos serviços.",
    "Nas integrações com o WhatsApp Business, o tratamento pode incluir número de telefone, identificadores de conta, conteúdo de mensagens, data e hora das interações, status de entrega e registros técnicos associados. Os dados efetivamente tratados dependem das funcionalidades habilitadas e das configurações da empresa cliente."
  ] },
  { title: "3. Para que utilizamos os dados", paragraphs: [
    "Utilizamos dados pessoais para cadastrar e autenticar usuários; executar contratos; disponibilizar funcionalidades de gestão e atendimento; receber, encaminhar e responder mensagens; automatizar respostas quando configurado; prestar suporte; manter registros operacionais; prevenir fraudes e incidentes; cumprir obrigações legais; e atender solicitações dos titulares.",
    "Quando funcionalidades de inteligência artificial estiverem habilitadas, informações necessárias à execução da funcionalidade poderão ser processadas por provedores tecnológicos contratados, conforme as configurações do serviço e os instrumentos aplicáveis."
  ] },
  { title: "4. Bases legais", paragraphs: [
    "O tratamento de dados pessoais observará as bases legais pertinentes da Lei nº 13.709/2018 (LGPD), que podem incluir execução de contrato e procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse quando cabível e consentimento nas situações em que for exigido. A base aplicável depende da finalidade e do contexto do tratamento."
  ] },
  { title: "5. WhatsApp Business e integrações Meta", paragraphs: [
    "As empresas clientes podem autorizar a conexão de suas contas do WhatsApp Business à PLENIUM para operar recursos de atendimento. As informações obtidas por meio das APIs da Meta são utilizadas para disponibilizar as funcionalidades autorizadas, incluindo identificação da conta conectada, recebimento e envio de mensagens e registros de atendimento.",
    "A PLENIUM não comercializa dados recebidos dessas integrações. O uso também está sujeito às políticas aplicáveis da Meta e do WhatsApp, bem como às escolhas e responsabilidades das empresas que utilizam a integração."
  ] },
  { title: "6. Compartilhamento e fornecedores", paragraphs: [
    "Dados pessoais podem ser compartilhados, na medida necessária, com provedores de infraestrutura, hospedagem, armazenamento, autenticação, envio de comunicações, processamento de pagamentos, integração e suporte, além de autoridades competentes quando houver obrigação legal. Esses terceiros deverão tratar os dados conforme suas funções e obrigações aplicáveis.",
    "O uso de serviços de terceiros pode envolver processamento ou armazenamento fora do Brasil. Quando aplicável, a PLENIUM observará os requisitos legais para transferências internacionais de dados."
  ] },
  { title: "7. Segurança e acesso", paragraphs: [
    "Adotamos medidas técnicas e administrativas voltadas à proteção dos dados, incluindo mecanismos de autenticação, controles de acesso por perfil e organização, proteção de credenciais e registros operacionais, de acordo com os riscos e as funcionalidades implementadas. Nenhum sistema é totalmente imune a incidentes, e nossas medidas são continuamente avaliadas."
  ] },
  { title: "8. Retenção e exclusão", paragraphs: [
    "Os dados são mantidos pelo período necessário às finalidades informadas, à execução dos contratos e ao cumprimento de obrigações legais ou regulatórias, ou para o exercício regular de direitos. Os prazos podem variar conforme a categoria de dado e o serviço contratado.",
    "Após o encerramento da finalidade ou do vínculo, os dados poderão ser excluídos ou anonimizados, ressalvadas as hipóteses legais de conservação e os procedimentos contratuais aplicáveis."
  ] },
  { title: "9. Direitos dos titulares", paragraphs: [
    "Nos termos da LGPD, o titular pode solicitar, conforme cabível, confirmação da existência de tratamento, acesso, correção, anonimização, bloqueio ou eliminação, portabilidade, informação sobre compartilhamentos, revogação do consentimento e revisão de decisões automatizadas nas hipóteses legais.",
    "Quando a PLENIUM atuar como operadora de uma empresa cliente, poderemos encaminhar a solicitação à controladora responsável ou orientar o titular a contatá-la."
  ] },
  { title: "10. Cookies e registros técnicos", paragraphs: [
    "O website e os sistemas podem utilizar cookies ou tecnologias equivalentes estritamente necessários para autenticação, segurança, preferências e funcionamento. Eventuais ferramentas opcionais de análise ou publicidade devem ser descritas e configuradas conforme seu uso efetivo e as exigências legais aplicáveis."
  ] },
  { title: "11. Atualizações desta política", paragraphs: [
    "Esta política pode ser atualizada para refletir mudanças nos serviços, nas práticas de tratamento ou na legislação. A versão vigente será disponibilizada nesta página com a data da última atualização."
  ] },
];

export default function PrivacyPolicyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f4f7fb", color: "#15263e", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header style={{ background: "#071f3c", padding: "18px 24px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link href="/" aria-label="Voltar à página inicial PLENIUM"><img src="/branding/plenium-brand-horizontal.png" alt="PLENIUM" style={{ width: 170, maxWidth: "45vw", height: "auto" }} /></Link>
          <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: 14 }}>Página inicial</Link>
        </div>
      </header>
      <article style={{ maxWidth: 920, margin: "0 auto", padding: "48px 24px 72px", lineHeight: 1.75 }}>
        <p style={{ color: "#2462a0", fontWeight: 700, fontSize: 13, letterSpacing: 1.5 }}>TRANSPARÊNCIA E PROTEÇÃO DE DADOS</p>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 44px)", lineHeight: 1.2, margin: "8px 0 12px" }}>Política de Privacidade</h1>
        <p style={{ color: "#5b6d80", marginBottom: 34 }}>Última atualização: 22 de outubro de 2026</p>
        <p>Esta política apresenta, de forma geral, como a PLENIUM trata dados pessoais em seus serviços. Recomendamos sua leitura antes de utilizar o website ou as soluções da plataforma.</p>
        {sections.map(({ title, paragraphs }) => (
          <section key={title} style={{ marginTop: 34 }}>
            <h2 style={{ fontSize: 21, lineHeight: 1.35, marginBottom: 10 }}>{title}</h2>
            {paragraphs.map((paragraph) => <p key={paragraph} style={{ margin: "10px 0" }}>{paragraph}</p>)}
          </section>
        ))}
        <section style={{ marginTop: 34 }}>
          <h2 style={{ fontSize: 21 }}>12. Contato sobre privacidade</h2>
          <p>Para dúvidas e solicitações relacionadas à privacidade e à proteção de dados, entre em contato pelo e-mail <a href="mailto:admin@pleniumgestao.com.br" style={{ color: "#1266a8" }}>admin@pleniumgestao.com.br</a>. Poderemos solicitar informações adicionais para confirmar a identidade do solicitante e localizar os dados pertinentes.</p>
        </section>
        <footer style={{ borderTop: "1px solid #d7e0e9", paddingTop: 20, marginTop: 48, color: "#5b6d80", fontSize: 13 }}>© PLENIUM — Ecossistema de Soluções</footer>
      </article>
    </main>
  );
}
