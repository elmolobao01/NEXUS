import Link from "next/link";

const products = [
  {
    id: "gestao",
    eyebrow: "GESTÃO CONECTADA",
    name: "NEXUS Gestão",
    description: "Organize processos, clientes, equipes, indicadores e operações em uma plataforma modular.",
    features: ["Gestão por módulos", "Indicadores e relatórios", "Ambiente multiempresa"],
  },
  {
    id: "ia",
    eyebrow: "INTELIGÊNCIA APLICADA",
    name: "NEXUS IA",
    description: "Acesse inteligência artificial, bases de conhecimento e especialistas digitais em um único ambiente.",
    features: ["Multi-IA", "NEXUS Knowledge", "Créditos com consumo controlado"],
  },
];

const whatsappNumber = (process.env.NEXT_PUBLIC_NEXUS_WHATSAPP || "5571999952478").replace(/\D/g, "");

function whatsappUrl(message) {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export default function HomePage() {
  return (
    <main className="nexus-home">
      <header className="nexus-home-header">
        <Link href="/" className="nexus-home-brand" aria-label="NEXUS - início">
          <img src="/branding/nexus-logo.png" alt="" />
          <span><strong>NEXUS</strong><small>INTELLIGENT SYSTEMS</small></span>
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
          <p>Contrate somente o que precisa hoje e amplie seu NEXUS quando quiser. Gestão e IA funcionam de forma independente — e juntas entregam ainda mais valor.</p>
          <div className="home-hero-actions">
            <a className="home-primary-button" href="#produtos">Conhecer soluções</a>
            <a className="home-secondary-button" href={whatsappUrl("Olá! Conheci o NEXUS pelo site e gostaria de entender qual solução é mais adequada para mim.")} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
          </div>
          <div className="home-trust-row"><span>✓ Contratação modular</span><span>✓ Benefício multiproduto</span><span>✓ Evolução sob demanda</span></div>
        </div>
        <div className="home-hero-visual" aria-hidden="true">
          <div className="home-orbit orbit-one" /><div className="home-orbit orbit-two" />
          <div className="home-nx-card"><img src="/branding/nexus-logo.png" alt="" /><strong>NEXUS</strong><span>Conexão • Inteligência • Futuro</span></div>
        </div>
      </section>

      <section className="home-section" id="produtos">
        <div className="home-section-heading"><span>SOLUÇÕES NEXUS</span><h2>Escolha como começar.</h2><p>Cada produto pode ser contratado separadamente. Ao combinar soluções, o cliente recebe condições exclusivas do Ecossistema NEXUS.</p></div>
        <div className="home-products-grid">
          {products.map((product) => (
            <article className={`home-product-card product-${product.id}`} key={product.id}>
              <span className="product-eyebrow">{product.eyebrow}</span><h3>{product.name}</h3><p>{product.description}</p>
              <ul>{product.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
              <div className="product-actions">
                <Link className="home-primary-button" href={`/contratar?produto=${product.id}`}>Contratar</Link>
                <a href={whatsappUrl(`Olá! Tenho dúvidas sobre o ${product.name} e gostaria de falar com o atendimento.`)} target="_blank" rel="noreferrer">Tirar dúvidas</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-how" id="como-funciona">
        <div className="home-section-heading"><span>COMO FUNCIONA</span><h2>Comece simples e evolua quando precisar.</h2></div>
        <div className="home-how-grid">
          <article><b>01</b><h3>Escolha</h3><p>Selecione NEXUS Gestão, NEXUS IA ou combine os dois.</p></article>
          <article><b>02</b><h3>Contrate</h3><p>Inicie a contratação pelo site ou fale com nosso atendimento.</p></article>
          <article><b>03</b><h3>Amplie</h3><p>Adicione novos produtos depois e receba o Benefício Ecossistema.</p></article>
        </div>
      </section>

      <section className="home-benefit" id="planos">
        <div><span className="home-kicker">BENEFÍCIO ECOSSISTEMA</span><h2>Quanto mais NEXUS, mais vantagem.</h2><p>Quem já utiliza NEXUS Gestão recebe condição especial para adicionar NEXUS IA. Quem começa pela IA também recebe benefício ao contratar Gestão.</p></div>
        <div className="benefit-flow"><span>01 produto<br/><strong>Preço individual</strong></span><b>+</b><span>02 produtos<br/><strong>Benefício exclusivo</strong></span><b>→</b><span>Ecossistema<br/><strong>Mais integração e valor</strong></span></div>
      </section>

      <section className="home-contact" id="atendimento">
        <div><span className="home-kicker">ATENDIMENTO NEXUS</span><h2>Ainda tem dúvidas?</h2><p>Converse com nosso atendimento pelo WhatsApp para esclarecer funcionalidades, planos, contratação ou expansão do seu ambiente.</p></div>
        <a className="home-whatsapp-button" href={whatsappUrl("Olá! Preciso de ajuda para entender as soluções NEXUS.")} target="_blank" rel="noreferrer">Conversar pelo WhatsApp</a>
      </section>

      <footer className="nexus-home-footer"><span>NEXUS Intelligent Systems</span><span>Conexão • Inteligência • Inovação • Confiança • Futuro</span></footer>
      <a className="home-whatsapp-float" href={whatsappUrl("Olá! Vim pelo site da NEXUS e gostaria de atendimento.")} target="_blank" rel="noreferrer" aria-label="Falar com a NEXUS pelo WhatsApp">WA</a>
    </main>
  );
}
