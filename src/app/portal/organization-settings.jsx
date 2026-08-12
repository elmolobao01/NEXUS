"use client";

import { useEffect, useState } from "react";

export default function OrganizationSettings({ organization, organizationId }) {
  const [units, setUnits] = useState([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!organizationId) return;
    const response = await fetch(`/api/portal/units?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setUnits(Array.isArray(data.units) ? data.units : []); else setMessage(data?.message || "Falha ao carregar unidades.");
  }
  useEffect(() => { load(); }, [organizationId]);

  async function addUnit(event) {
    event.preventDefault(); if (!name.trim()) return; setSaving(true); setMessage("");
    const response = await fetch("/api/portal/units", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, name: name.trim(), code: code.trim() }) });
    const data = await response.json();
    if (!response.ok) setMessage(data?.message || "Não foi possível cadastrar a unidade.");
    else { setName(""); setCode(""); setMessage("Unidade cadastrada com sucesso."); await load(); }
    setSaving(false);
  }

  return <>
    <section className="client-section-intro"><div><span className="eyebrow">CONFIGURAÇÃO SOB MEDIDA</span><h2>Configurações da organização</h2><p>Estruture identidade, unidades e parâmetros que definem como o NEXUS funciona para sua realidade.</p></div></section>
    <section className="client-content-grid"><article className="client-panel"><div className="panel-heading"><div><span className="eyebrow">IDENTIDADE</span><h3>Dados da organização</h3></div></div><dl className="client-data-list"><div><dt>Nome</dt><dd>{organization?.nomeFantasia || "—"}</dd></div><div><dt>Razão social</dt><dd>{organization?.razaoSocial || "—"}</dd></div><div><dt>Segmento</dt><dd>{organization?.segmento || "—"}</dd></div><div><dt>Contato</dt><dd>{organization?.contatos?.email || "—"}</dd></div></dl><p className="client-note">Na próxima evolução, esta área receberá upload de logomarca, identidade visual e campos personalizados da organização.</p></article><article className="client-panel"><div className="panel-heading"><div><span className="eyebrow">ESTRUTURA</span><h3>Unidades</h3></div><span className="tag">{units.length}</span></div><div className="activity-list">{units.map((u, i) => <div key={u.id}><span className="activity-index">{String(i+1).padStart(2,"0")}</span><div><strong>{u.name}</strong><small>{u.code || "Sem código"}{u.is_main ? " · Unidade Matriz" : ""}</small></div><span className={u.active ? "activity-status" : "activity-status inactive"}>{u.active ? "Ativa" : "Inativa"}</span></div>)}</div></article></section>
    <section className="client-panel" style={{marginTop:16}}><div className="panel-heading"><div><span className="eyebrow">NOVA UNIDADE</span><h3>Adicionar estrutura</h3></div></div>{message ? <div className="client-feedback">{message}</div> : null}<form className="inline-unit-form" onSubmit={addUnit}><label><span>Nome da unidade</span><input required value={name} onChange={(e)=>setName(e.target.value)} placeholder="Ex.: Unidade Centro"/></label><label><span>Código interno</span><input value={code} onChange={(e)=>setCode(e.target.value.toUpperCase())} placeholder="CENTRO"/></label><button className="primary-button" disabled={saving}>{saving ? "Salvando…" : "+ Adicionar unidade"}</button></form></section>
  </>;
}
