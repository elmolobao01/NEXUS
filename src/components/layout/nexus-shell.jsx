"use client";

import { useMemo, useState } from "react";
import { portfolioThemes } from "@/design-system/temas";
import { clientesIniciais, modulosComerciais, planosComerciais } from "@/core/clientes/catalogo";

const navItems = [
  "Visão geral",
  "Clientes",
  "Contratos",
  "Planos e módulos",
  "Hospedagem",
  "Organizações",
  "Unidades",
  "Usuários",
  "Permissões",
  "Auditoria",
  "Configurações",
];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Overview({ theme }) {
  const receitaMensal = clientesIniciais.reduce((total, cliente) => total + cliente.valorMensal, 0);
  const metricas = [
    ["Clientes ativos", String(clientesIniciais.filter((item) => item.status === "Ativo").length).padStart(2, "0")],
    ["Contratos", String(clientesIniciais.length).padStart(2, "0")],
    ["Receita mensal", currency.format(receitaMensal)],
    ["Módulos comerciais", String(modulosComerciais.length).padStart(2, "0")],
  ];

  return (
    <>
      <section className="hero-card hero-brand">
        <div>
          <span className="hero-badge">Arquitetura oficial</span>
          <h2>Uma única fundação para múltiplos segmentos.</h2>
          <p>{theme.description}</p>
        </div>
        <div className="hero-logo-wrap">
          <img src="/branding/nexus-logo.png" alt="Logomarca NEXUS" className="hero-logo" />
        </div>
      </section>

      <section className="metrics-grid" aria-label="Indicadores da fundação">
        {metricas.map(([label, value]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>Controle comercial preparado</small>
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
            <span className="tag">Base 1.2</span>
          </div>
          <div className="architecture-list">
            {[
              ["Núcleo", "Organizações, unidades, usuários, permissões e auditoria"],
              ["Sistema visual", "Componentes, tokens e motor de temas por portfólio"],
              ["Gestão comercial", "Clientes, planos, módulos, contratos, valores e vencimentos"],
              ["Infraestrutura", "Hospedagem, Supabase, segurança, integrações e implantação"],
            ].map(([title, description], index) => (
              <div className="architecture-item" key={title}>
                <span className="architecture-number">0{index + 1}</span>
                <div><strong>{title}</strong><p>{description}</p></div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel checklist-panel">
          <div className="panel-heading"><div><span className="eyebrow">Gestão comercial</span><h3>Controle centralizado</h3></div></div>
          <ul className="checklist">
            {[
              "Cadastro único de clientes e contatos",
              "Contratos com início, término e vencimento",
              "Planos com limites e preços-base",
              "Módulos adicionais por cliente",
              "Hospedagem contabilizada no contrato",
              "Receita mensal recorrente consolidada",
            ].map((item) => <li key={item}><span>✓</span>{item}</li>)}
          </ul>
        </article>
      </section>
    </>
  );
}

function Clientes() {
  const [busca, setBusca] = useState("");
  const clientes = clientesIniciais.filter((cliente) => `${cliente.nome} ${cliente.segmento} ${cliente.plano}`.toLowerCase().includes(busca.toLowerCase()));
  return (
    <section className="panel commercial-panel">
      <div className="panel-heading commercial-heading">
        <div><span className="eyebrow">Carteira comercial</span><h3>Clientes e contratos de uso</h3></div>
        <button className="primary-button" type="button">Novo cliente</button>
      </div>
      <div className="toolbar"><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar cliente, segmento ou plano" /></div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Cliente</th><th>Segmento</th><th>Plano</th><th>Módulos</th><th>Mensalidade</th><th>Status</th></tr></thead>
          <tbody>{clientes.map((cliente) => <tr key={cliente.id}>
            <td><strong>{cliente.nome}</strong><small>{cliente.id} · {cliente.unidades} unidade(s)</small></td>
            <td>{cliente.segmento}</td><td>{cliente.plano}</td><td>{cliente.modulos.length}</td><td>{currency.format(cliente.valorMensal)}</td>
            <td><span className={`status-badge status-${cliente.status.toLowerCase().replace("ç", "c").replace("ã", "a")}`}>{cliente.status}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function Contratos() {
  return <section className="cards-stack">
    {clientesIniciais.map((cliente) => <article className="panel contract-card" key={cliente.id}>
      <div className="contract-top"><div><span className="eyebrow">{cliente.id}</span><h3>{cliente.nome}</h3></div><span className={`status-badge status-${cliente.status.toLowerCase().replace("ç", "c").replace("ã", "a")}`}>{cliente.status}</span></div>
      <div className="contract-grid">
        <div><small>Vigência</small><strong>{cliente.inicioContrato} — {cliente.fimContrato}</strong></div>
        <div><small>Vencimento</small><strong>{cliente.vencimento}</strong></div>
        <div><small>Plano</small><strong>{cliente.plano}</strong></div>
        <div><small>Valor mensal</small><strong>{currency.format(cliente.valorMensal)}</strong></div>
      </div>
      <div className="module-chips">{cliente.modulos.map((modulo) => <span key={modulo}>{modulo}</span>)}</div>
    </article>)}
  </section>;
}

function PlanosEModulos() {
  return <section className="plans-layout">
    <div className="plans-grid">{planosComerciais.map((plano) => <article className="panel plan-card" key={plano.id}>
      <span className="eyebrow">Plano</span><h3>{plano.nome}</h3><p>{plano.descricao}</p><strong className="plan-price">{currency.format(plano.valorBase)}<small>/mês</small></strong>
      <div className="plan-detail">{plano.limiteUnidades ? `Até ${plano.limiteUnidades} unidade(s)` : "Unidades ilimitadas"}</div>
    </article>)}</div>
    <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Catálogo</span><h3>Módulos comercializáveis</h3></div></div>
      <div className="module-catalog">{modulosComerciais.map((modulo) => <div className="module-row" key={modulo.id}><div><strong>{modulo.nome}</strong><small>{modulo.categoria}{modulo.obrigatorio ? " · obrigatório" : ""}</small></div><strong>{currency.format(modulo.valorMensal)}</strong></div>)}</div>
    </article>
  </section>;
}

function Hospedagem() {
  const contratosHospedagem = clientesIniciais.filter((cliente) => cliente.modulos.includes("Hospedagem Gerenciada"));
  return <section className="content-grid">
    <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Infraestrutura</span><h3>Hospedagem gerenciada</h3></div><span className="tag">{contratosHospedagem.length} contratos</span></div>
      <div className="hosting-summary"><strong>{currency.format(contratosHospedagem.length * 220)}</strong><span>Receita mensal estimada com hospedagem</span></div>
      <ul className="checklist"><li><span>✓</span>Ambiente de produção na Vercel</li><li><span>✓</span>Banco de dados e armazenamento</li><li><span>✓</span>Monitoramento, backup e disponibilidade</li><li><span>✓</span>Atualizações de segurança</li></ul>
    </article>
    <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Clientes hospedados</span><h3>Ambientes ativos</h3></div></div>
      <div className="module-catalog">{contratosHospedagem.map((cliente) => <div className="module-row" key={cliente.id}><div><strong>{cliente.nome}</strong><small>{cliente.segmento} · {cliente.unidades} unidade(s)</small></div><span className="status-badge status-ativo">Ativo</span></div>)}</div>
    </article>
  </section>;
}

export function NexusShell() {
  const [portfolio, setPortfolio] = useState("educacao");
  const [activeSection, setActiveSection] = useState("Visão geral");
  const theme = portfolioThemes[portfolio];
  const cssVars = useMemo(() => ({ "--accent": theme.accent, "--accent-strong": theme.accentStrong, "--soft": theme.soft, "--surface": theme.surface, "--theme-text": theme.text }), [theme]);

  const content = activeSection === "Clientes" ? <Clientes /> : activeSection === "Contratos" ? <Contratos /> : activeSection === "Planos e módulos" ? <PlanosEModulos /> : activeSection === "Hospedagem" ? <Hospedagem /> : <Overview theme={theme} />;

  return <main className={`app-shell theme-${portfolio}`} style={cssVars}>
    <aside className="sidebar">
      <div className="brand-block"><img src="/branding/nexus-logo.png" alt="NEXUS" className="brand-logo" /><div><strong>NEXUS</strong><span>Foundation 1.2</span></div></div>
      <nav className="navigation" aria-label="Navegação principal">{navItems.map((item) => <button className={activeSection === item ? "nav-item active" : "nav-item"} key={item} type="button" onClick={() => setActiveSection(item)}><span className="nav-dot" />{item}</button>)}</nav>
      <div className="portfolio-picker"><label htmlFor="portfolio">Identidade do portfólio</label><select id="portfolio" value={portfolio} onChange={(event) => setPortfolio(event.target.value)}>{Object.entries(portfolioThemes).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></div>
      <div className="sidebar-status"><span className="status-light" /><div><strong>Fundação operacional</strong><small>Com gestão comercial inicial</small></div></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">Ecossistema inteligente de soluções</span><h1>{activeSection === "Visão geral" ? theme.name : activeSection}</h1></div><div className="topbar-actions"><button type="button" className="ghost-button">Documentação</button><button type="button" className="primary-button">Iniciar configuração</button></div></header>
      {content}
    </section>
  </main>;
}
