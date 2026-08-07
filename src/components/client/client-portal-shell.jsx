"use client";

import { useEffect, useMemo, useState } from "react";
import { portfolioThemes } from "../../design-system/temas";
import { indicadoresPorPortfolio, organizacoesDemo } from "../../core/acessos/configuracao";

export function ClientPortalShell() {
  const [organizationId, setOrganizationId] = useState(organizacoesDemo[0].id);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("organizacao");
    if (requested && organizacoesDemo.some((item) => item.id === requested)) {
      setOrganizationId(requested);
    }
  }, []);
  const [activeModule, setActiveModule] = useState("Visão geral");
  const organization = organizacoesDemo.find((item) => item.id === organizationId) || organizacoesDemo[0];
  const theme = portfolioThemes[organization.portfolio];
  const indicators = indicadoresPorPortfolio[organization.portfolio];
  const cssVars = useMemo(() => ({
    "--accent": theme.accent,
    "--accent-strong": theme.accentStrong,
    "--soft": theme.soft,
    "--surface": theme.surface,
    "--theme-text": theme.text,
  }), [theme]);

  return (
    <main className={`client-shell theme-${organization.portfolio}`} style={cssVars}>
      <aside className="client-sidebar">
        <div className="client-brand"><img src="/branding/nexus-logo.png" alt="NEXUS" /><div><strong>{theme.name}</strong><span>Portal do Cliente</span></div></div>
        <div className="client-identity"><small>Organização</small><strong>{organization.nome}</strong><span>{organization.unidade}</span></div>
        <nav className="client-navigation" aria-label="Módulos contratados">{organization.modulos.map((item) => <button key={item} className={activeModule === item ? "client-nav active" : "client-nav"} type="button" onClick={() => setActiveModule(item)}><span />{item}</button>)}</nav>
        <div className="client-user"><span className="user-avatar">GL</span><div><strong>Gestor Local</strong><small>{organization.perfil}</small></div></div>
      </aside>

      <section className="client-workspace">
        <header className="client-topbar">
          <div><span className="eyebrow">Ambiente operacional do cliente</span><h1>{activeModule}</h1><p>{organization.nome} · {organization.unidade}</p></div>
          <div className="client-top-actions"><label><span>Alternar demonstração</span><select value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setActiveModule("Visão geral"); }}>{organizacoesDemo.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><a className="ghost-button link-button" href="/login">Sair</a></div>
        </header>

        {activeModule === "Visão geral" ? (
          <>
            <section className="client-hero"><div><span className="hero-badge">{organization.perfil}</span><h2>Bem-vindo ao {theme.name}</h2><p>{theme.description}</p></div><div className="client-hero-mark">NX</div></section>
            <section className="client-metrics">{indicators.map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</section>
            <section className="client-content-grid">
              <article className="client-panel"><div className="panel-heading"><div><span className="eyebrow">Operação</span><h3>Atividades prioritárias</h3></div><span className="tag">Hoje</span></div><div className="activity-list">{organization.modulos.slice(1, 5).map((item, index) => <div key={item}><span className="activity-index">0{index + 1}</span><div><strong>{item}</strong><small>{index % 2 === 0 ? "Atualizações disponíveis para acompanhamento" : "Nenhuma pendência crítica identificada"}</small></div><span className="activity-status">Acessar</span></div>)}</div></article>
              <article className="client-panel"><div className="panel-heading"><div><span className="eyebrow">Licença</span><h3>Módulos habilitados</h3></div></div><ul className="licensed-list">{organization.modulos.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul></article>
            </section>
          </>
        ) : (
          <section className="client-panel module-placeholder"><span className="eyebrow">Módulo contratado</span><h2>{activeModule}</h2><p>Esta rota já respeita o menu e a identidade do cliente. A funcionalidade de negócio será implementada na sprint específica do portfólio.</p><button className="primary-button" type="button">Iniciar desenvolvimento do módulo</button></section>
        )}
      </section>
    </main>
  );
}
