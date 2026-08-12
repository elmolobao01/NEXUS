"use client";

import { useEffect, useMemo, useState } from "react";

const PERFIS = [
  ["MANAGER", "Gestor"],
  ["SUPERVISOR", "Supervisor"],
  ["OPERATOR", "Operador"],
  ["VIEWER", "Consulta"],
];

const PERMISSOES = [
  ["financeiro", "Financeiro"],
  ["estoque", "Estoque"],
  ["documentos", "Documentos"],
  ["processos", "Processos e Workflow"],
  ["relatorios", "Relatórios"],
  ["indicadores", "Indicadores"],
];

const EMPTY = { fullName: "", email: "", roleTitle: "", phone: "", profile: "OPERATOR", unitIds: [], permissions: {} };

function phone(value = "") {
  const d = String(value).replace(/\D/g, "").slice(0, 11);
  return d.length > 10 ? d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3") : d.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
}

export default function UsersManagement({ organizationId, canInvite = true }) {
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!organizationId) return;
    setLoading(true);
    setMessage("");
    try {
      const [u, un] = await Promise.all([
        fetch(`/api/portal/users?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" }),
        fetch(`/api/portal/units?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" }),
      ]);
      const ud = await u.json(); const und = await un.json();
      if (!u.ok) throw new Error(ud?.message || "Falha ao carregar usuários.");
      if (!un.ok) throw new Error(und?.message || "Falha ao carregar unidades.");
      setUsers(Array.isArray(ud.users) ? ud.users : []);
      setUnits(Array.isArray(und.units) ? und.units : []);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao carregar dados."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [organizationId]);

  const active = useMemo(() => users.filter((u) => u.active).length, [users]);

  function toggleUnit(id) {
    setForm((f) => ({ ...f, unitIds: f.unitIds.includes(id) ? f.unitIds.filter((x) => x !== id) : [...f.unitIds, id] }));
  }
  function togglePermission(id) {
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [id]: !f.permissions[id] } }));
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/portal/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, organizationId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Não foi possível convidar o usuário.");
      setModal(false); setForm(EMPTY); setMessage("Convite enviado e perfil criado com sucesso."); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao convidar usuário."); }
    finally { setSaving(false); }
  }

  async function toggleActive(user) {
    setMessage("");
    const response = await fetch("/api/portal/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.user_id, profile: user.profile, active: !user.active, fullName: user.full_name, roleTitle: user.role_title, phone: user.phone, permissions: user.permissions || {}, unitIds: user.unit_ids || [] }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data?.message || "Não foi possível atualizar o usuário."); return; }
    await load();
  }

  return <>
    <section className="client-section-intro"><div><span className="eyebrow">ADMINISTRAÇÃO DA ORGANIZAÇÃO</span><h2>Usuários e permissões</h2><p>Cadastre sua equipe, defina perfis, unidades de acesso e recursos autorizados.</p></div>{canInvite ? <button className="primary-button" type="button" onClick={() => setModal(true)}>+ Novo usuário</button> : null}</section>
    <section className="client-metrics compact"><article><span>Usuários cadastrados</span><strong>{loading ? "…" : users.length}</strong><small>Vínculos da organização</small></article><article><span>Ativos</span><strong>{loading ? "…" : active}</strong><small>Acessos liberados</small></article><article><span>Unidades</span><strong>{units.length}</strong><small>Escopos disponíveis</small></article></section>
    {message ? <div className="client-feedback">{message}</div> : null}
    <section className="client-panel"><div className="panel-heading"><div><span className="eyebrow">EQUIPE</span><h3>Acessos da organização</h3></div></div><div className="client-table-wrap"><table className="client-table"><thead><tr><th>Usuário</th><th>Perfil</th><th>Unidades</th><th>Status</th><th>Ação</th></tr></thead><tbody>{!loading && users.map((u) => <tr key={u.user_id}><td><strong>{u.full_name || u.email}</strong><small>{u.email}<br/>{u.role_title || "Cargo não informado"}</small></td><td>{PERFIS.find(([id]) => id === u.profile)?.[1] || (u.profile === "CLIENT_ADMIN" ? "Administrador" : u.profile)}</td><td>{(u.unit_ids || []).length || "Todas/geral"}</td><td><span className={u.active ? "activity-status" : "activity-status inactive"}>{u.active ? "Ativo" : "Inativo"}</span></td><td>{u.profile !== "CLIENT_ADMIN" ? <button className="table-action" type="button" onClick={() => toggleActive(u)}>{u.active ? "Suspender" : "Reativar"}</button> : <span className="table-muted">Responsável principal</span>}</td></tr>)}{loading ? <tr><td colSpan="5">Carregando usuários…</td></tr> : null}{!loading && users.length === 0 ? <tr><td colSpan="5">Nenhum usuário cadastrado para esta organização.</td></tr> : null}</tbody></table></div></section>
    {modal ? <div className="client-modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true"><header><div><span className="eyebrow">NOVO ACESSO</span><h2>Convidar usuário</h2><p>O usuário receberá um convite para definir o acesso ao NEXUS.</p></div><button type="button" onClick={() => setModal(false)}>×</button></header><form onSubmit={submit}><div className="client-form-grid"><label><span>Nome *</span><input required value={form.fullName} onChange={(e) => setForm({...form, fullName:e.target.value})}/></label><label><span>E-mail *</span><input required type="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})}/></label><label><span>Função/Cargo</span><input value={form.roleTitle} onChange={(e) => setForm({...form, roleTitle:e.target.value})}/></label><label><span>Telefone</span><input value={phone(form.phone)} onChange={(e) => setForm({...form, phone:e.target.value.replace(/\D/g,"")})}/></label><label><span>Perfil</span><select value={form.profile} onChange={(e) => setForm({...form, profile:e.target.value})}>{PERFIS.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label></div><div className="client-choice-block"><strong>Unidades de acesso</strong><div className="client-chip-grid">{units.map((u) => <button type="button" key={u.id} className={form.unitIds.includes(u.id) ? "active" : ""} onClick={() => toggleUnit(u.id)}>{form.unitIds.includes(u.id) ? "✓ " : ""}{u.name}</button>)}</div></div><div className="client-choice-block"><strong>Permissões adicionais</strong><div className="client-chip-grid">{PERMISSOES.map(([id,label]) => <button type="button" key={id} className={form.permissions[id] ? "active" : ""} onClick={() => togglePermission(id)}>{form.permissions[id] ? "✓ " : ""}{label}</button>)}</div></div><footer><button type="button" className="ghost-button" onClick={() => setModal(false)}>Cancelar</button><button disabled={saving} className="primary-button" type="submit">{saving ? "Enviando…" : "Enviar convite"}</button></footer></form></section></div> : null}
  </>;
}
