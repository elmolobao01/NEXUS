import Link from "next/link";
import CommercialExperience from "./commercial-experience";

const whatsappNumber = (process.env.NEXT_PUBLIC_NEXUS_WHATSAPP || "5571999412478").replace(/\D/g, "");

function whatsappUrl(message) {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export default function HomePage() {
  return (
    <main className="nexus-home">
      <header className="nexus-home-header">
        <Link href="/" className="nexus-home-brand" aria-label="PLENIUM - início">
          <img className="plenium-brand-horizontal" src="/branding/plenium-brand-horizontal.png" alt="PLENIUM — Ecossistema de Soluções" />
        </Link>
        <nav className="nexus-home-nav" aria-label="Navegação principal">
          <a href="#produtos">Produtos</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
          <a href="#atendimento">Fale conosco</a>
          <Link className="home-login-link" href="/login">Entrar</Link>
        </nav>
      </header>

      <section className="nexus-home-hero">
        <div className="home-hero-copy">
          <span className="home-kicker">UM ECOSSISTEMA. MÚLTIPLAS SOLUÇÕES.</span>
          <h1>Conecte gestão e inteligência para transformar resultados.</h1>
          <p>Contrate somente o que precisa hoje e amplie seu PLENIUM quando quiser. Escolha sua operação especializada, Gestão administrativa opcional e complementos digitais.</p>
          <div className="home-hero-actions">
            <a className="home-primary-button" href="#produtos">Conhecer soluções</a>
            <a className="home-secondary-button" href={whatsappUrl("Olá! Conheci o PLENIUM pelo site e gostaria de entender qual solução é mais adequada para mim.")} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
          </div>
          <div className="home-trust-row"><span>✓ Contratação modular</span><span>✓ Benefício multiproduto</span><span>✓ Evolução sob demanda</span></div>
        </div>
        <div className="home-hero-visual" aria-hidden="true">
          <div className="home-orbit orbit-one" /><div className="home-orbit orbit-two" />
          <div className="home-brand-showcase"><img src="/branding/plenium-instagram.png" alt="PLENIUM — Ecossistema de Soluções" /></div>
        </div>
      </section>

      <CommercialExperience />
      <section className="home-how" id="como-funciona"><div className="home-section-heading"><h2>Escolha, simule e consulte ofertas.</h2><p>Seja Plenium. Um ecossistema inteiro para o seu negócio.</p></div></section>
      <section className="home-contact" id="atendimento">
        <div><span className="home-kicker">ATENDIMENTO PLENIUM</span><h2>Ainda tem dúvidas?</h2><p>Converse com nosso atendimento pelo WhatsApp para esclarecer funcionalidades, planos, contratação ou expansão do seu ambiente.</p></div>
        <a className="home-whatsapp-button" href={whatsappUrl("Olá! Preciso de ajuda para entender as soluções PLENIUM.")} target="_blank" rel="noreferrer">Conversar pelo WhatsApp</a>
      </section>

      <footer className="nexus-home-footer">
        <div className="nexus-footer-brand">
          <img src="/branding/plenium-brand-horizontal-dark.png" alt="PLENIUM — Ecossistema de Soluções" />
          <span>Soluções hoje. Grandes amanhãs.</span>
        </div>
        <div className="nexus-footer-legal">
          <span>CNPJ 68.473.390/0001-50</span>
          <span>Salvador – Bahia</span>
          <span>© 2026 PLENIUM. Todos os direitos reservados.</span>
        </div>
      </footer>
      <a className="home-whatsapp-float" href={whatsappUrl("Olá! Vim pelo site da PLENIUM e gostaria de atendimento.")} target="_blank" rel="noreferrer" aria-label="Falar com a PLENIUM pelo WhatsApp">WA</a>
    </main>
  );
}
