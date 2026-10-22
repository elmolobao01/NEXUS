import Link from "next/link";

const header = <header style={{background:"#071f3c",padding:"18px 24px"}}><div style={{maxWidth:920,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16}}><Link href="/" aria-label="PLENIUM - página inicial"><img src="/branding/plenium-brand-horizontal.png" alt="PLENIUM" style={{width:170,maxWidth:"45vw",height:"auto"}} /></Link><Link href="/" style={{color:"white",fontSize:14,textDecoration:"none"}}>Página inicial</Link></div></header>;
function LegalPage({ eyebrow, title, intro, sections }) {return <main style={{minHeight:"100vh",background:"#f4f7fb",color:"#15263e",fontFamily:"Arial, Helvetica, sans-serif"}}>{header}<article style={{maxWidth:920,margin:"0 auto",padding:"48px 24px 72px",lineHeight:1.75}}><p style={{color:"#2462a0",fontWeight:700,fontSize:13,letterSpacing:1.5}}>{eyebrow}</p><h1 style={{fontSize:"clamp(30px, 5vw, 44px)",lineHeight:1.2,margin:"8px 0 12px"}}>{title}</h1><p style={{color:"#5b6d80",marginBottom:34}}>Última atualização: 22 de outubro de 2026</p><p>{intro}</p>{sections.map(({title, paragraphs})=><section key={title} style={{marginTop:34}}><h2 style={{fontSize:21,lineHeight:1.35,marginBottom:10}}>{title}</h2>{paragraphs.map(p=><p key={p} style={{margin:"10px 0"}}>{p}</p>)}</section>)}<section style={{marginTop:34}}><h2 style={{fontSize:21}}>Contato</h2><p>Para esclarecimentos e solicitações, escreva para <a href="mailto:admin@pleniumgestao.com.br" style={{color:"#1266a8"}}>admin@pleniumgestao.com.br</a>.</p></section><footer style={{borderTop:"1px solid #d7e0e9",paddingTop:20,marginTop:48,color:"#5b6d80",fontSize:13}}>© PLENIUM — Ecossistema de Soluções · <Link href="/politica-de-privacidade">Política de Privacidade</Link> · <Link href="/termos-de-servico">Termos de Serviço</Link> · <Link href="/exclusao-de-dados">Exclusão de Dados</Link></footer></article></main>}

export const metadata = { title: "Exclusão de Dados | PLENIUM", description: "Instruções públicas para solicitar exclusão de dados pessoais na PLENIUM.", robots: {index:true,follow:true} };
const sections = [
  {
    "title": "1. Como solicitar a exclusão",
    "paragraphs": [
      "Envie um e-mail para admin@pleniumgestao.com.br com o assunto “Solicitação de exclusão de dados pessoais”. Informe seu nome, um meio de contato e, se aplicável, a empresa ou conta à qual a solicitação está relacionada. Não envie senhas, tokens ou documentos sensíveis no primeiro contato."
    ]
  },
  {
    "title": "2. Confirmação de identidade",
    "paragraphs": [
      "Para proteger os titulares, a PLENIUM poderá solicitar informações adicionais estritamente necessárias para verificar a identidade e a legitimidade do pedido antes de realizar qualquer ação sobre os dados."
    ]
  },
  {
    "title": "3. Dados de empresas clientes",
    "paragraphs": [
      "Se seus dados foram coletados ou tratados por uma empresa que utiliza o NEXUS ou o PLENIUM Chatbot, essa empresa pode ser a controladora responsável. Nesse caso, a PLENIUM poderá orientar o contato com a empresa ou encaminhar o pedido à responsável, conforme o contrato e a legislação."
    ]
  },
  {
    "title": "4. Análise e atendimento",
    "paragraphs": [
      "Após receber o pedido, a PLENIUM avaliará os dados envolvidos, a natureza da solicitação e as hipóteses legais aplicáveis. A resposta informará o encaminhamento e, quando cabível, a exclusão, anonimização, bloqueio ou a justificativa para conservação. O prazo de atendimento seguirá os requisitos legais aplicáveis ao caso."
    ]
  },
  {
    "title": "5. Limites legais de exclusão",
    "paragraphs": [
      "Nem todos os dados podem ser eliminados imediatamente. Informações necessárias ao cumprimento de obrigações legais ou regulatórias, ao exercício regular de direitos, à prevenção de fraudes ou a outras hipóteses legais de conservação poderão ser mantidas pelo período necessário."
    ]
  },
  {
    "title": "6. Integrações com a Meta e WhatsApp",
    "paragraphs": [
      "A solicitação à PLENIUM alcança os dados sob sua responsabilidade ou sob seu processamento autorizado. A exclusão de dados mantidos diretamente pela Meta ou por uma empresa cliente pode exigir solicitação separada ao respectivo responsável. A desconexão de uma conta WhatsApp Business não implica, por si só, eliminação de todos os registros sujeitos a retenção legítima."
    ]
  },
  {
    "title": "7. Acompanhamento",
    "paragraphs": [
      "Utilize o mesmo e-mail da solicitação para pedir informações sobre seu andamento. Se possível, mencione a data do primeiro contato para facilitar a localização do atendimento."
    ]
  },
  {
    "title": "8. Outras opções de privacidade",
    "paragraphs": [
      "Além da exclusão, você pode solicitar acesso, correção e outros direitos previstos na LGPD, conforme aplicável. Consulte também nossa Política de Privacidade para entender as categorias de dados e as finalidades de tratamento."
    ]
  }
];
export default function Page() { return <LegalPage eyebrow="DIREITOS DOS TITULARES" title="Exclusão de Dados" intro="Esta página explica como solicitar a exclusão de dados pessoais tratados no contexto dos serviços PLENIUM, incluindo integrações com WhatsApp Business." sections={sections} />; }
