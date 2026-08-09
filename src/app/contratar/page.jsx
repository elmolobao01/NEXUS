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
        <div className="contract-copy">
          <span className="home-kicker">CONTRATAÇÃO NEXUS</span>
          <h1>Comece pelo produto certo para você.</h1>
          <p>Preencha seus dados para iniciar a contratação. Nesta etapa, o NEXUS organiza sua solicitação e encaminha o atendimento já contextualizado pelo WhatsApp.</p>
          <div className="contract-benefit"><strong>Benefício Ecossistema</strong><span>Ao combinar produtos, aplicamos condição comercial diferenciada.</span></div>
        </div>

        <ContractForm initialProduct={initialProduct} origem={origem} />
      </section>
    </main>
  );
}
