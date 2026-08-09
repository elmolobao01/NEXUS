import Link from "next/link";
import ContractForm from "./contract-form";

const productLabels = {
  gestao: "NEXUS Gestão",
  ia: "NEXUS IA",
  combo: "NEXUS Gestão + NEXUS IA",
};

export default async function ContratarPage({ searchParams }) {
  const params = await searchParams;
  const initialProduct = productLabels[params?.produto] ? params.produto : "gestao";
  const origem = params?.origem === "cliente" ? "cliente" : "site";

  return (
    <main className="nexus-contract-page">
      <header className="nexus-contract-header">
        <Link href="/" className="nexus-home-brand"><img src="/branding/nexus-logo.png" alt="" /><span><strong>NEXUS</strong><small>INTELLIGENT SYSTEMS</small></span></Link>
        <Link href="/login" className="home-login-link">Já sou cliente</Link>
      </header>

      <section className="contract-shell">
        <div className="contract-copy contract-copy-sticky">
          <span className="home-kicker">CONTRATAÇÃO NEXUS</span>
          <h1>Comece pelo produto certo para você.</h1>
          <p>Escolha a solução e o segmento. O NEXUS apresenta uma configuração adequada à sua operação e encaminha sua solicitação já contextualizada.</p>

          <div className="contract-benefit">
            <strong>Benefício Ecossistema</strong>
            <span>Ao combinar produtos, aplicamos condição comercial diferenciada.</span>
          </div>

          <aside className="contract-included-card">
            <span className="contract-included-kicker">INCLUSO NA SUA CONTRATAÇÃO</span>
            <div className="contract-included-item free">
              <strong>IMPLANTAÇÃO GRÁTIS</strong>
              <span>Configuração inicial da solução sem taxa de implantação.</span>
            </div>
            <div className="contract-included-item">
              <strong>Formação técnica inclusa</strong>
              <span>Orientação da equipe para utilização dos recursos contratados.</span>
            </div>
            <div className="contract-included-item">
              <strong>Suporte técnico incluso</strong>
              <span>Acompanhamento para utilização e funcionamento da plataforma.</span>
            </div>
            <div className="contract-included-item">
              <strong>Configuração sob medida</strong>
              <span>Estrutura ajustada ao porte, processos e necessidades da sua empresa.</span>
            </div>
            <p>Sua empresa não precisa se adaptar ao sistema. <b>O NEXUS se adapta à sua operação.</b></p>
          </aside>
        </div>

        <ContractForm initialProduct={initialProduct} origem={origem} />
      </section>

      <footer className="nexus-home-footer nexus-contract-footer">
        <div className="nexus-footer-brand">
          <strong>NEXUS</strong>
          <span>Tecnologia • Gestão • Inteligência Artificial</span>
        </div>
        <div className="nexus-footer-legal">
          <span>CNPJ 68.473.390/0001-50</span>
          <span>Salvador – Bahia</span>
          <span>© 2026 NEXUS. Todos os direitos reservados.</span>
        </div>
      </footer>
    </main>
  );
}
