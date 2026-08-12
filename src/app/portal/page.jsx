"use client";

import { useEffect, useMemo, useState } from "react";
import { ORGANIZACAO_DEMO } from "@/core/organizacoes/modelo";
import { resumoCentral } from "@/core/assinaturas/central-cliente";

const operationalModules = ["Visão geral", "Operação", "Indicadores", "Usuários", "Relatórios", "Configurações"];
const metrics = [["Unidades", "01", "Ambiente principal"], ["Usuários", "24", "25 contratados"], ["Módulos", "03", "Recursos operacionais"], ["Disponibilidade", "99,9%", "Serviços operacionais"]];
const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

function CentralCliente() {
  const central = useMemo(() => resumoCentral(ORGANIZACAO_DEMO), []);
  return <>
    <section className="client-hero"><div><span className="hero-badge">CENTRAL DO CLIENTE</span><h2>Seu ecossistema NEXUS</h2><p>Consulte sua contratação atual, benefícios, limites e amplie sua estrutura com novos produtos, módulos e Facilities.</p></div><div className="client-hero-mark">NX</div></section>
    <section className="client-metrics">
      <article><span>Plano vigente</span><strong>{central.plano}</strong><small>{central.modalidade} · {central.duracaoMeses} meses</small></article>
      <article><span>Mensalidade atual</span><strong>{money(central.valorMensal)}</strong><small>Condição contratual vigente</small></article>
      <article><span>Benefício atual</span><strong>{money(central.economiaMensal)}</strong><small>Economia mensal estimada</small></article>
      <article><span>Renovação</span><strong>{central.renovacaoEm ? new Date(`${central.renovacaoEm}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</strong><small>Status: {central.status}</small></article>
    </section>
    <section className="client-content-grid">
      <article className="client-panel"><div className="panel-heading"><div><span className="eyebrow">CONTRATAÇÃO</span><h3>Produtos ativos</h3></div><span className="tag">VIGENTE</span></div><div className="activity-list">{central.produtos.map((produto) => <div key={produto.id}><span className="activity-index">✓</span><div><strong>{produto.nome}</strong><small>Produto contratado e disponível para sua organização</small></div><span className="activity-status">Ativo</span></div>)}</div></article>
      <article className="client-panel"><div className="panel-heading"><div><span className="eyebrow">BENEFÍCIO ECOSSISTEMA</span><h3>Amplie seu NEXUS</h3></div></div><p>Produtos contratados em conjunto podem receber condições diferenciadas. O prazo contratual também pode gerar desconto progressivo.</p><a className="primary-button" style={{display:"inline-flex",textDecoration:"none",marginTop:12}} href="/contratar?origem=cliente">Ver produtos e condições</a></article>
    </section>
    <section className="client-content-grid" style={{marginTop:16}}>
      <article className="client-panel"><div className="panel-heading"><div><span className="eyebrow">MÓDULOS</span><h3>Operação habilitada</h3></div></div><ul className="licensed-list">{central.modulos.map((item) => <li key={item.id}><span>✓</span>{item.nome}</li>)}</ul></article>
      <article className="client-panel"><div className="panel-heading"><div><span className="eyebrow">FACILITIES</span><h3>Facilidades ativas</h3></div></div><ul className="licensed-list">{central.facilities.map((item) => <li key={item.id}><span>✓</span>{item.nome}</li>)}</ul><a className="ghost-button" style={{display:"inline-flex",textDecoration:"none",marginTop:12}} href="/contratar?origem=cliente">Adicionar Facility</a></article>
    </section>
    <section className="client-panel" style={{marginTop:16}}><div className="panel-heading"><div><span className="eyebrow">LIMITES DA ASSINATURA</span><h3>Capacidade contratada</h3></div></div><div className="client-metrics"><article><span>Usuários</span><strong>{central.limites.usuarios ?? "—"}</strong><small>Cadastro gerenciado na operação</small></article><article><span>Unidades</span><strong>{central.limites.unidades ?? "—"}</strong><small>Estruturas habilitadas</small></article><article><span>Armazenamento</span><strong>{central.limites.armazenamentoGb ?? "—"} GB</strong><small>Franquia contratada</small></article></div></section>
  </>;
}

export default function PortalPage() {
  const [profile, setProfile] = useState(null);
  const [organization, setOrganization] = useState(ORGANIZACAO_DEMO);
  const [units, setUnits] = useState(ORGANIZACAO_DEMO.unidades);
  const [activeModule, setActiveModule] = useState("Visão geral");
  const canManageSubscription = ["NEXUS_ROOT", "NEXUS_ADMIN", "CLIENT_ADMIN"].includes(profile);
  const modules = canManageSubscription
    ? ["Central do Cliente", ...operationalModules]
    : operationalModules;

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((session) => {
        if (!active || !session?.authenticated) return;
        setProfile(session.profile);
        if (session.organizationId) {
          fetch("/api/portal/context", { cache: "no-store" })
            .then((r) => r.ok ? r.json() : null)
            .then((ctx) => {
              if (!ctx?.organization) return;
              setOrganization({ ...ORGANIZACAO_DEMO, id: ctx.organization.id, nomeFantasia: ctx.organization.name, razaoSocial: ctx.organization.legal_name || ctx.organization.name, segmento: ctx.organization.segment, logoUrl: ctx.organization.logo_url || null, contatos: { email: ctx.organization.email, telefone: ctx.organization.phone }, configuracoes: ctx.organization.settings || {} });
              if (ctx.units?.length) setUnits(ctx.units.map((u) => ({ id: u.id, nome: u.name, principal: u.is_main })));
            })
            .catch(() => {});
        }
        // O responsável contratual entra diretamente na Central; os demais
        // perfis entram na operação autorizada, sem escolha manual.
        setActiveModule(["NEXUS_ROOT", "NEXUS_ADMIN", "CLIENT_ADMIN"].includes(session.profile) ? "Central do Cliente" : "Visão geral");
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }
  return <main className="client-shell theme-educacao"><aside className="client-sidebar"><div className="client-brand"><div className="client-brand-mark" aria-hidden="true">NX</div><div><strong>NEXUS</strong><span>Ambiente da Organização</span></div></div><div className="client-identity"><small>Organização</small><strong>{organization.nomeFantasia}</strong><span>{units[0]?.nome || "Unidade Matriz"}</span></div><nav className="client-navigation" aria-label="Áreas disponíveis">{modules.map((item) => <button key={item} type="button" className={activeModule === item ? "client-nav active" : "client-nav"} onClick={() => setActiveModule(item)}><span />{item}</button>)}</nav><div className="client-user"><span className="user-avatar">NX</span><div><strong>Administrador</strong><small>Organização NEXUS</small></div></div></aside>
  <section className="client-workspace"><header className="client-topbar"><div><span className="eyebrow">{activeModule === "Central do Cliente" ? "RELACIONAMENTO COMERCIAL NEXUS" : "AMBIENTE OPERACIONAL DO CLIENTE"}</span><h1>{activeModule}</h1><p>{organization.nomeFantasia} · NEXUS sob medida</p></div><div className="client-top-actions"><button type="button" className="ghost-button" onClick={logout}>Sair</button></div></header>
  {activeModule === "Central do Cliente" ? <CentralCliente /> : activeModule === "Visão geral" ? <><section className="client-hero"><div><span className="hero-badge">AMBIENTE OPERACIONAL</span><h2>Bem-vindo ao NEXUS</h2><p>Seu ambiente reúne estrutura, módulos e recursos autorizados para a realidade da sua organização.</p></div><div className="client-hero-mark">NX</div></section><section className="client-metrics">{metrics.map(([label,value,detail]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</section><section className="client-content-grid"><article className="client-panel"><div className="panel-heading"><div><span className="eyebrow">OPERAÇÃO</span><h3>Ambiente preparado</h3></div><span className="tag">ONLINE</span></div><div className="activity-list">{["Operação","Indicadores","Usuários","Relatórios"].map((item,index) => <div key={item}><span className="activity-index">0{index+1}</span><div><strong>{item}</strong><small>Estrutura disponível para a organização.</small></div><span className="activity-status">Ativo</span></div>)}</div></article><article className="client-panel"><div className="panel-heading"><div><span className="eyebrow">GESTÃO</span><h3>Atalhos administrativos</h3></div></div><ul className="licensed-list"><li><span>✓</span>Usuários e permissões</li><li><span>✓</span>Unidades e responsáveis</li><li><span>✓</span>Identidade e logomarca</li><li><span>✓</span>Configuração sob medida</li></ul></article></section></> : <section className="client-panel client-module-placeholder"><span className="eyebrow">ÁREA OPERACIONAL</span><h2>{activeModule}</h2><p>Esta área permanece separada da Central do Cliente e receberá as funcionalidades específicas da organização e do segmento.</p></section>}
  </section></main>;
}
