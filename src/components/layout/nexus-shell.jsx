"use client";

import { useMemo, useState } from "react";
import { portfolioThemes } from "@/design-system/temas";

const metrics = [
  ["Organizações", "01"],
  ["Unidades", "04"],
  ["Usuários", "128"],
  ["Serviços do núcleo", "08"],
];

const navItems = ["Visão geral", "Organizações", "Unidades", "Usuários", "Permissões", "Auditoria", "Configurações"];

export function NexusShell() {
  const [portfolio, setPortfolio] = useState("educacao");
  const theme = portfolioThemes[portfolio];

  const cssVars = useMemo(() => ({
    "--accent": theme.accent,
    "--accent-strong": theme.accentStrong,
    "--soft": theme.soft,
    "--surface": theme.surface,
    "--theme-text": theme.text,
  }), [theme]);

  return (
    <main className={`app-shell theme-${portfolio}`} style={cssVars}>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">NX</div>
          <div>
            <strong>NEXUS</strong>
            <span>Foundation 1.0</span>
          </div>
        </div>

        <nav className="navigation" aria-label="Navegação principal">
          {navItems.map((item, index) => (
            <button className={index === 0 ? "nav-item active" : "nav-item"} key={item} type="button">
              <span className="nav-dot" />
              {item}
            </button>
          ))}
        </nav>

        <div className="portfolio-picker">
          <label htmlFor="portfolio">Identidade do portfólio</label>
          <select id="portfolio" value={portfolio} onChange={(event) => setPortfolio(event.target.value)}>
            {Object.entries(portfolioThemes).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>
        </div>

        <div className="sidebar-status">
          <span className="status-light" />
          <div>
            <strong>Fundação homologável</strong>
            <small>Núcleo sem módulos de negócio</small>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Ecossistema inteligente de soluções</span>
            <h1>{theme.name}</h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="ghost-button">Documentação</button>
            <button type="button" className="primary-button">Iniciar configuração</button>
          </div>
        </header>

        <section className="hero-card">
          <div>
            <span className="hero-badge">Arquitetura oficial</span>
            <h2>Uma única fundação para múltiplos segmentos.</h2>
            <p>{theme.description}</p>
          </div>
          <div className="hero-symbol">NX</div>
        </section>

        <section className="metrics-grid" aria-label="Indicadores da fundação">
          {metrics.map(([label, value]) => (
            <article className="metric-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>Estrutura preparada</small>
            </article>
          ))}
        </section>

        <section className="content-grid">
          <article className="panel architecture-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Núcleo NEXUS</span>
                <h3>Camadas permanentes da plataforma</h3>
              </div>
              <span className="tag">Base 1.0</span>
            </div>
            <div className="architecture-list">
              {[
                ["Núcleo", "Organizações, unidades, usuários, permissões e auditoria"],
                ["Sistema visual", "Componentes, tokens e motor de temas por portfólio"],
                ["Portfólios", "Educação, Saúde, Restaurantes e Governamental"],
                ["Infraestrutura", "Supabase, segurança, integrações e implantação"],
              ].map(([title, description], index) => (
                <div className="architecture-item" key={title}>
                  <span className="architecture-number">0{index + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel checklist-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Validação inicial</span>
                <h3>Critérios de homologação</h3>
              </div>
            </div>
            <ul className="checklist">
              {[
                "Next.js com App Router em src/app",
                "TypeScript estrito e alias interno único",
                "Motor de temas sem pacotes externos locais",
                "Arquitetura modular em uma aplicação",
                "Build de produção validado",
                "Pronto para primeiro deploy na Vercel",
              ].map((item) => <li key={item}><span>✓</span>{item}</li>)}
            </ul>
          </article>
        </section>
      </section>
    </main>
  );
}
