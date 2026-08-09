import Link from "next/link";

const products = [
  {
    id: "gestao",
    eyebrow: "GESTÃO CONECTADA",
    name: "NEXUS Gestão",
    description: "Gestão profissional para negócios de todos os segmentos e tamanhos, com estrutura modular que acompanha o crescimento da sua operação.",
    features: ["Para todos os segmentos e negócios", "Gestão por módulos", "Indicadores e relatórios inteligentes", "Estrutura profissional e escalável"],
    included: ["Implantação inicial GRÁTIS", "Formação técnica INCLUSA", "Suporte técnico INCLUSO"],
  },
  {
    id: "ia",
    eyebrow: "INTELIGÊNCIA APLICADA",
    name: "NEXUS IA",
    description: "Acesse inteligência artificial, bases de conhecimento e especialistas digitais em um único ambiente.",
    features: ["Multi-IA", "NEXUS Knowledge", "Acesso inteligente às principais IAs"],
    included: ["Configuração inicial GRÁTIS", "Formação para utilização INCLUSA", "Suporte técnico INCLUSO"],
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
              <div className="product-included"><strong>SERVIÇOS INCLUSOS</strong>{product.included.map((item) => <span key={item}>🎁 {item}</span>)}</div>
              <div className="product-actions">
                <a className="home-primary-button" href="#planos">Ver planos</a>
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

      <section className="home-section home-plans" id="planos">
        <div className="home-section-heading"><span>PLANOS NEXUS</span><h2>Escolha o pacote ideal para o seu momento.</h2><p>Comece com a estrutura necessária hoje e evolua quando precisar. A contratação acontece somente depois da escolha do plano.</p></div>
        <div className="home-plans-grid">
          <article className="home-plan-card"><span className="product-eyebrow">NEXUS GESTÃO</span><h3>Planos de Gestão</h3><p>Opções para pequenos, médios e grandes negócios, em qualquer segmento.</p><div className="plan-free-badge">IMPLANTAÇÃO GRÁTIS</div><ul><li>✓ Formação técnica inclusa</li><li>✓ Suporte técnico incluso</li><li>✓ Estrutura modular e escalável</li></ul><Link className="home-primary-button" href="/contratar?produto=gestao">Conhecer planos de Gestão</Link></article>
          <article className="home-plan-card"><span className="product-eyebrow">NEXUS IA</span><h3>Planos de Inteligência</h3><p>Acesso inteligente às principais IAs e recursos de conhecimento.</p><div className="plan-free-badge">CONFIGURAÇÃO GRÁTIS</div><ul><li>✓ Formação para utilização inclusa</li><li>✓ Suporte técnico incluso</li><li>✓ Multi-IA + NEXUS Knowledge</li></ul><Link className="home-primary-button" href="/contratar?produto=ia">Conhecer planos de IA</Link></article>
          <article className="home-plan-card plan-combo"><span className="product-eyebrow">BENEFÍCIO ECOSSISTEMA</span><h3>Gestão + IA</h3><p>Combine os produtos e receba condições exclusivas, integração e mais valor.</p><div className="plan-free-badge">MAIS VANTAGEM</div><ul><li>★ Benefício multiproduto</li><li>🎁 Implantação inicial grátis</li><li>✓ Formação e suporte inclusos</li></ul><Link className="home-primary-button" href="/contratar?produto=combo">Conhecer o combo</Link></article>
        </div>
        <p className="home-business-message"><strong>Estrutura de grandes organizações, acessível para negócios de todos os tamanhos.</strong><br/>Sua empresa não precisa ser grande para ter uma grande gestão. Comece com o que precisa hoje e amplie seu NEXUS conforme o negócio cresce.</p>
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
