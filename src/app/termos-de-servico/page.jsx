import Link from "next/link";

const header = <header style={{background:"#071f3c",padding:"18px 24px"}}><div style={{maxWidth:920,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16}}><Link href="/" aria-label="PLENIUM - página inicial"><img src="/branding/plenium-brand-horizontal.png" alt="PLENIUM" style={{width:170,maxWidth:"45vw",height:"auto"}} /></Link><Link href="/" style={{color:"white",fontSize:14,textDecoration:"none"}}>Página inicial</Link></div></header>;
function LegalPage({ eyebrow, title, intro, sections }) {return <main style={{minHeight:"100vh",background:"#f4f7fb",color:"#15263e",fontFamily:"Arial, Helvetica, sans-serif"}}>{header}<article style={{maxWidth:920,margin:"0 auto",padding:"48px 24px 72px",lineHeight:1.75}}><p style={{color:"#2462a0",fontWeight:700,fontSize:13,letterSpacing:1.5}}>{eyebrow}</p><h1 style={{fontSize:"clamp(30px, 5vw, 44px)",lineHeight:1.2,margin:"8px 0 12px"}}>{title}</h1><p style={{color:"#5b6d80",marginBottom:34}}>Última atualização: 22 de outubro de 2026</p><p>{intro}</p>{sections.map(({title, paragraphs})=><section key={title} style={{marginTop:34}}><h2 style={{fontSize:21,lineHeight:1.35,marginBottom:10}}>{title}</h2>{paragraphs.map(p=><p key={p} style={{margin:"10px 0"}}>{p}</p>)}</section>)}<section style={{marginTop:34}}><h2 style={{fontSize:21}}>Contato</h2><p>Para esclarecimentos e solicitações, escreva para <a href="mailto:admin@pleniumgestao.com.br" style={{color:"#1266a8"}}>admin@pleniumgestao.com.br</a>.</p></section><footer style={{borderTop:"1px solid #d7e0e9",paddingTop:20,marginTop:48,color:"#5b6d80",fontSize:13}}>© PLENIUM — Ecossistema de Soluções · <Link href="/politica-de-privacidade">Política de Privacidade</Link> · <Link href="/termos-de-servico">Termos de Serviço</Link> · <Link href="/exclusao-de-dados">Exclusão de Dados</Link></footer></article></main>}

export const metadata = { title: "Termos de Serviço | PLENIUM", description: "Condições gerais de utilização dos serviços PLENIUM e NEXUS.", robots: {index:true,follow:true} };
const sections = [
  {
    "title": "1. Sobre o serviço",
    "paragraphs": [
      "A PLENIUM disponibiliza soluções digitais de gestão empresarial e atendimento, incluindo o ecossistema NEXUS e o PLENIUM Chatbot. As funcionalidades disponíveis dependem do produto, do plano contratado e das integrações efetivamente habilitadas."
    ]
  },
  {
    "title": "2. Aceitação e contratação",
    "paragraphs": [
      "O acesso e a utilização dos serviços pressupõem a aceitação dos termos aplicáveis. Condições comerciais, valores, vigência, franquias, implantação e regras específicas são definidos na contratação e nos instrumentos complementares. Em caso de divergência, as condições expressamente pactuadas prevalecem no âmbito permitido pela legislação."
    ]
  },
  {
    "title": "3. Contas, credenciais e segurança",
    "paragraphs": [
      "O cliente deve fornecer informações corretas, proteger suas credenciais e administrar os usuários autorizados. Deve comunicar prontamente suspeitas de uso indevido ou incidentes de segurança pelos canais oficiais. A PLENIUM poderá adotar medidas proporcionais para proteger a plataforma e seus usuários."
    ]
  },
  {
    "title": "4. Responsabilidades das empresas clientes",
    "paragraphs": [
      "Cada empresa é responsável pela legitimidade dos dados que insere, pelas informações prestadas a seus consumidores, pelas autorizações necessárias e pelo conteúdo das mensagens enviadas por sua conta. O uso da plataforma deve respeitar a legislação aplicável e os direitos de terceiros."
    ]
  },
  {
    "title": "5. WhatsApp Business e serviços de terceiros",
    "paragraphs": [
      "A integração com a Plataforma do WhatsApp Business depende de autorização válida da empresa titular da conta e da disponibilidade das APIs da Meta. O uso está sujeito às políticas, limites, modelos de mensagem e requisitos de consentimento estabelecidos pela Meta. A PLENIUM não controla alterações, suspensões ou indisponibilidades determinadas por provedores externos."
    ]
  },
  {
    "title": "6. Chatbots e automação",
    "paragraphs": [
      "As respostas automatizadas dependem de configuração, disponibilidade técnica e plano contratado. O cliente deve supervisionar os fluxos e verificar a adequação das informações transmitidas. Recursos baseados em inteligência artificial podem gerar respostas imprecisas e não substituem revisão humana quando necessária."
    ]
  },
  {
    "title": "7. Privacidade e dados pessoais",
    "paragraphs": [
      "O tratamento de dados pessoais segue a Política de Privacidade da PLENIUM e os instrumentos contratuais aplicáveis. As responsabilidades entre PLENIUM e empresas clientes dependem da operação de tratamento realizada, observada a LGPD."
    ]
  },
  {
    "title": "8. Disponibilidade, manutenção e alterações",
    "paragraphs": [
      "A PLENIUM poderá realizar atualizações, correções e manutenções para preservar a segurança e a evolução dos serviços. Eventuais níveis de serviço, suporte e condições de indisponibilidade são aqueles definidos no contrato correspondente."
    ]
  },
  {
    "title": "9. Uso indevido e suspensão",
    "paragraphs": [
      "Não é permitido utilizar os serviços para fraude, spam, violação de direitos, acesso não autorizado ou práticas contrárias às políticas das plataformas integradas. Medidas de restrição ou suspensão poderão ser adotadas quando necessárias e conforme os termos contratuais e a legislação aplicável."
    ]
  },
  {
    "title": "10. Propriedade intelectual",
    "paragraphs": [
      "As marcas, interfaces, sistemas e materiais da PLENIUM são protegidos pela legislação aplicável. A contratação não transfere direitos de propriedade intelectual, salvo previsão contratual expressa. Os dados e conteúdos de titularidade dos clientes permanecem sujeitos aos respectivos direitos e obrigações."
    ]
  },
  {
    "title": "11. Encerramento e dados",
    "paragraphs": [
      "O encerramento dos serviços, eventual exportação de informações e a exclusão ou retenção de dados observarão o contrato, a Política de Privacidade, as obrigações legais e as possibilidades técnicas do serviço."
    ]
  },
  {
    "title": "12. Atualizações destes termos",
    "paragraphs": [
      "Os termos podem ser atualizados para refletir alterações legais, operacionais ou de produtos. Mudanças que exijam comunicação ou nova aceitação serão tratadas conforme a legislação e os instrumentos contratuais aplicáveis."
    ]
  }
];
export default function Page() { return <LegalPage eyebrow="CONDIÇÕES DE UTILIZAÇÃO" title="Termos de Serviço" intro="Estes termos apresentam regras gerais de uso das soluções PLENIUM. Leia também o contrato e as condições específicas do produto contratado." sections={sections} />; }
