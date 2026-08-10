"use client";

import { useMemo, useState } from "react";
import { ORGANIZACAO_DEMO } from "@/core/organizacoes/modelo";
import { resumoCentral } from "@/core/assinaturas/central-cliente";

const modules = ["Visão geral", "Operação", "Indicadores", "Usuários", "Relatórios", "Central do Cliente", "Configurações"];
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
  const [activeModule, setActiveModule] = useState("Visão geral");
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }
  return <main className="client-shell theme-educacao"><aside className="client-sidebar"><div className="client-brand"><img src="/branding/nexus-logo.png" alt="NEXUS" /><div><strong>NEXUS</strong><span>Ambiente da Organização</span></div></div><div className="client-identity"><small>Organização</small><strong>{ORGANIZACAO_DEMO.nomeFantasia}</strong><span>{ORGANIZACAO_DEMO.unidades[0]?.nome}</span></div><nav className="client-navigation" aria-label="Áreas disponíveis">{modules.map((item) => <button key={item} type="button" className={activeModule === item ? "client-nav active" : "client-nav"} onClick={() => setActiveModule(item)}><span />{item}</button>)}</nav><div className="client-user"><span className="user-avatar">NX</span><div><strong>Administrador</strong><small>Organização NEXUS</small></div></div></aside>
  <section className="client-workspace"><header className="client-topbar"><div><span className="eyebrow">{activeModule === "Central do Cliente" ? "RELACIONAMENTO COMERCIAL NEXUS" : "AMBIENTE OPERACIONAL DO CLIENTE"}</span><h1>{activeModule}</h1><p>{ORGANIZACAO_DEMO.nomeFantasia} · NEXUS sob medida</p></div><div className="client-top-actions"><button type="button" className="ghost-button" onClick={logout}>Sair</button></div></header>
  {activeModule === "Central do Cliente" ? <CentralCliente /> : activeModule === "Visão geral" ? <><section className="client-hero"><div><span className="hero-badge">AMBIENTE OPERACIONAL</span><h2>Bem-vindo ao NEXUS</h2><p>Seu ambiente reúne estrutura, módulos e recursos autorizados para a realidade da sua organização.</p></div><div className="client-hero-mark">NX</div></section><section className="client-metrics">{metrics.map(([label,value,detail]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</section><section className="client-content-grid"><article className="client-panel"><div className="panel-heading"><div><span className="eyebrow">OPERAÇÃO</span><h3>Ambiente preparado</h3></div><span className="tag">ONLINE</span></div><div className="activity-list">{["Operação","Indicadores","Usuários","Relatórios"].map((item,index) => <div key={item}><span className="activity-index">0{index+1}</span><div><strong>{item}</strong><small>Estrutura disponível para a organização.</small></div><span className="activity-status">Ativo</span></div>)}</div></article><article className="client-panel"><div className="panel-heading"><div><span className="eyebrow">GESTÃO</span><h3>Atalhos administrativos</h3></div></div><ul className="licensed-list"><li><span>✓</span>Usuários e permissões</li><li><span>✓</span>Unidades e responsáveis</li><li><span>✓</span>Identidade e logomarca</li><li><span>✓</span>Configuração sob medida</li></ul></article></section></> : <section className="client-panel client-module-placeholder"><span className="eyebrow">ÁREA OPERACIONAL</span><h2>{activeModule}</h2><p>Esta área permanece separada da Central do Cliente e receberá as funcionalidades específicas da organização e do segmento.</p></section>}
  </section></main>;
}
