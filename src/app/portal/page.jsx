"use client";

import { useState } from "react";

const modules = [
  "Visão geral",
  "Operação",
  "Indicadores",
  "Usuários",
  "Relatórios",
  "Produtos",
  "Configurações",
];

const metrics = [
  ["Unidades", "01", "Ambiente principal"],
  ["Usuários", "24", "Acessos ativos"],
  ["Módulos", "06", "Recursos contratados"],
  ["Disponibilidade", "99,9%", "Serviços operacionais"],
];

export default function PortalPage() {
  const [activeModule, setActiveModule] = useState("Visão geral");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="client-shell theme-educacao">
      <aside className="client-sidebar">
        <div className="client-brand">
          <img src="/branding/nexus-logo.png" alt="NEXUS" />
          <div>
            <strong>NEXUS</strong>
            <span>Portal do Cliente</span>
          </div>
        </div>

        <div className="client-identity">
          <small>Ambiente</small>
          <strong>Minha Organização</strong>
          <span>Operação NEXUS</span>
        </div>

        <nav className="client-navigation" aria-label="Módulos disponíveis">
          {modules.map((item) => (
            <button
              key={item}
              type="button"
              className={activeModule === item ? "client-nav active" : "client-nav"}
              onClick={() => setActiveModule(item)}
            >
              <span />
              {item}
            </button>
          ))}
        </nav>

        <div className="client-user">
          <span className="user-avatar">NX</span>
          <div>
            <strong>Usuário NEXUS</strong>
            <small>Ambiente autenticado</small>
          </div>
        </div>
      </aside>

      <section className="client-workspace">
        <header className="client-topbar">
          <div>
            <span className="eyebrow">AMBIENTE OPERACIONAL DO CLIENTE</span>
            <h1>{activeModule}</h1>
            <p>Ecossistema Inteligente de Gestão Operacional</p>
          </div>

          <div className="client-top-actions">
            <button type="button" className="ghost-button" onClick={logout}>
              Sair
            </button>
          </div>
        </header>

        {activeModule === "Visão geral" ? (
          <>
            <section className="client-hero">
              <div>
                <span className="hero-badge">PORTAL DO CLIENTE</span>
                <h2>Bem-vindo ao NEXUS</h2>
                <p>
                  Seu ambiente reúne módulos, indicadores e operações
                  autorizados para sua organização.
                </p>
              </div>
              <div className="client-hero-mark">NX</div>
            </section>

            <section className="client-metrics">
              {metrics.map(([label, value, detail]) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{detail}</small>
                </article>
              ))}
            </section>

            <section className="client-content-grid">
              <article className="client-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">OPERAÇÃO</span>
                    <h3>Ambiente preparado</h3>
                  </div>
                  <span className="tag">ONLINE</span>
                </div>

                <div className="activity-list">
                  {modules.slice(1, 5).map((item, index) => (
                    <div key={item}>
                      <span className="activity-index">0{index + 1}</span>
                      <div>
                        <strong>{item}</strong>
                        <small>
                          Estrutura disponível para integração com os dados da organização.
                        </small>
                      </div>
                      <span className="activity-status">Ativo</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="client-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">LICENÇA</span>
                    <h3>Módulos habilitados</h3>
                  </div>
                </div>

                <ul className="licensed-list">
                  {modules.map((item) => (
                    <li key={item}>
                      <span>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          </>
        ) : activeModule === "Produtos" ? (
          <section className="client-panel client-module-placeholder">
            <span className="eyebrow">MEU ECOSSISTEMA</span>
            <h2>Produtos NEXUS</h2>
            <p>Visualize seus produtos contratados e amplie seu ambiente com novas soluções NEXUS.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginTop:24}}>
              <article style={{padding:22,border:"1px solid #dbe5ef",borderRadius:18,background:"#fff"}}>
                <small style={{color:"#16834b",fontWeight:800}}>PRODUTO ATIVO</small><h3>NEXUS Gestão</h3><p>Seu ambiente operacional e módulos contratados.</p>
                <button type="button" className="ghost-button">Gerenciar produto</button>
              </article>
              <article style={{padding:22,border:"1px solid #b9d3ff",borderRadius:18,background:"#f7fbff"}}>
                <small style={{color:"#0066ff",fontWeight:800}}>BENEFÍCIO DISPONÍVEL</small><h3>NEXUS IA</h3><p>Adicione Multi-IA e Knowledge com condição exclusiva por já ser cliente NEXUS.</p>
                <a className="ghost-button" style={{display:"inline-flex",textDecoration:"none"}} href="#">Adicionar produto</a>
              </article>
            </div>
          </section>
        ) : (
          <section className="client-panel client-module-placeholder">
            <span className="eyebrow">MÓDULO</span>
            <h2>{activeModule}</h2>
            <p>Esta área está preparada para receber as funcionalidades específicas contratadas pela organização.</p>
          </section>
        )}
      </section>
    </main>
  );
}
