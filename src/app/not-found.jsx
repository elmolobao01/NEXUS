export default function NotFoundPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <section style={{ maxWidth: 560, textAlign: "center" }}>
        <p style={{ color: "#0066ff", fontWeight: 700, letterSpacing: ".08em" }}>NEXUS</p>
        <h1 style={{ margin: "12px 0", color: "#111827" }}>Página não encontrada</h1>
        <p style={{ color: "#4b5563" }}>A rota solicitada não existe nesta versão da plataforma.</p>
        <a href="/" style={{ display: "inline-block", marginTop: 20, color: "#0066ff", fontWeight: 700 }}>Voltar ao início</a>
      </section>
    </main>
  );
}
