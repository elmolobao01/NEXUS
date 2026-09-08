"use client";

import { useEffect, useMemo, useState } from "react";

const TABS = ["Visão geral", "Domínios", "Supabase", "Vercel", "GitHub", "APIs", "Serviços", "Contas", "Alertas"];
const PRODUCT_OPTIONS = ["PLENIUM", "SIGEE", "ALÔ ID", "Compartilhado", "Outro"];

const money = (value, currency = "BRL") => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value || 0));
const isoToday = () => new Date().toISOString().slice(0, 10);
const dateBR = (value) => {
  if (!value) return "—";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
};
const daysUntil = (value) => {
  if (!value) return null;
  const today = new Date(`${isoToday()}T00:00:00Z`);
  const target = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Math.ceil((target - today) / 86400000);
};
const consumptionPercent = (item) => {
  const limit = Number(item?.limit_value || 0);
  return limit > 0 ? Math.max(0, (Number(item?.used_value || 0) / limit) * 100) : null;
};
const parseLimits = (text) => {
  const result = {};
  String(text || "").split(/\r?\n/).forEach((line) => {
    const [keyRaw, valueRaw] = line.split("=");
    const key = String(keyRaw || "").trim();
    const value = Number(String(valueRaw || "").trim().replace(",", "."));
    if (key && Number.isFinite(value) && value >= 0) result[key] = value;
  });
  return result;
};

function healthLabel(value) {
  return ({ ONLINE: "Online", DEGRADED: "Degradado", OFFLINE: "Offline", ATTENTION: "Atenção", UNKNOWN: "Não verificado" })[value] || value || "Não verificado";
}

function categoryMatch(service, type) {
  const provider = String(service.provider || "").toLowerCase();
  const category = String(service.category || "").toUpperCase();
  // Domínios precisam ser classificados explicitamente. URLs de APIs também contêm pontos
  // e não podem cair na aba Domínios apenas pelo formato do identificador.
  if (type === "Domínios") return category === "DOMINIO" || provider.includes("registro.br");
  if (type === "Supabase") return provider.includes("supabase");
  if (type === "Vercel") return provider.includes("vercel");
  if (type === "GitHub") return provider.includes("github");
  if (type === "APIs") return ["IA", "API"].includes(category) || provider.includes("api") || provider.includes("openai") || provider.includes("mercado pago");
  return true;
}

export default function InfrastructureSection() {
  const [tab, setTab] = useState("Visão geral");
  const [data, setData] = useState({ services: [], plans: [], accounts: [], consumption: [], syncRuns: [], alerts: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(null);
  const [selectedService, setSelectedService] = useState("");
  const [editingService, setEditingService] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/infraestrutura", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Falha ao carregar infraestrutura.");
      setData(payload);
      if (!selectedService && payload.services?.[0]?.id) setSelectedService(payload.services[0].id);
    } catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const plansByService = useMemo(() => {
    const map = new Map();
    data.plans.forEach((plan) => {
      if (!map.has(plan.service_id)) map.set(plan.service_id, []);
      map.get(plan.service_id).push(plan);
    });
    return map;
  }, [data.plans]);

  const latestConsumption = useMemo(() => {
    const map = new Map();
    data.consumption.forEach((item) => {
      const key = `${item.service_id}:${item.metric_key}`;
      if (!map.has(key)) map.set(key, item);
    });
    return [...map.values()];
  }, [data.consumption]);

  const activePlans = useMemo(() => data.plans.filter((item) => item.is_active), [data.plans]);
  const openAlerts = useMemo(() => data.alerts.filter((item) => item.status === "OPEN"), [data.alerts]);

  const metrics = useMemo(() => {
    const monthlyEquivalent = activePlans.reduce((sum, plan) => {
      const price = Number(plan.price || 0);
      return sum + ({ MONTHLY: price, QUARTERLY: price / 3, SEMIANNUAL: price / 6, ANNUAL: price / 12, BIENNIAL: price / 24 })[plan.billing_cycle] || 0;
    }, 0);
    const openAccounts = data.accounts.filter((item) => item.status === "OPEN");
    const overdue = openAccounts.filter((item) => daysUntil(item.due_on) < 0);
    const due30 = openAccounts.filter((item) => { const d = daysUntil(item.due_on); return d !== null && d >= 0 && d <= 30; });
    const highConsumption = latestConsumption.filter((item) => (consumptionPercent(item) || 0) >= 80);
    return { monthlyEquivalent, overdue, due30, highConsumption };
  }, [activePlans, data.accounts, latestConsumption]);

  async function send(method, body, url = "/api/admin/infraestrutura") {
    setMessage("");
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Operação não concluída.");
    return payload;
  }

  async function refreshAlerts() {
    try {
      const result = await send("POST", { entity: "refresh-alerts" });
      setMessage(`${result.generated || 0} alerta(s) automático(s) recalculado(s).`);
      await load();
    } catch (error) { setMessage(error.message); }
  }

  async function generatePayables() {
    const until = new Date(); until.setMonth(until.getMonth() + 12);
    try {
      const result = await send("POST", { entity: "generate-payables", until: until.toISOString().slice(0, 10) });
      setMessage(`${result.generated || 0} cobrança(s) nova(s) gerada(s).`); await refreshAlerts();
    } catch (error) { setMessage(error.message); }
  }

  async function syncProvider(serviceId, provider) {
    const key = String(provider || "").toLowerCase();
    const label = key === "vercel" ? "Vercel" : "GitHub";
    setMessage(`Sincronizando ${label}…`);
    try {
      const result = await send("POST", { serviceId }, `/api/admin/infraestrutura/${key}/sync`);
      const detail = key === "vercel"
        ? (result.deployment?.state ? ` Último deployment: ${result.deployment.state}.` : "")
        : (result.commit?.sha ? ` Commit: ${String(result.commit.sha).slice(0, 7)}.` : "");
      setMessage(`${label} sincronizado.${detail}`);
      await load();
    } catch (error) { setMessage(error.message); }
  }

  async function syncSupabase(serviceId) {
    setMessage("Coletando métricas do Supabase…");
    try {
      const result = await send("POST", { serviceId }, "/api/admin/infraestrutura/supabase/sync");
      setMessage(`${result.metricsCount || 0} métrica(s) atualizada(s).`); await refreshAlerts();
    } catch (error) { setMessage(error.message); }
  }

  async function syncDomain(serviceId) {
    setMessage("Verificando domínio, DNS e certificado SSL…");
    try {
      const result = await send("POST", { serviceId }, "/api/admin/infraestrutura/dominio/sync");
      const parts = [];
      if (result.domain) parts.push(result.domain);
      if (result.dns?.ok) parts.push("DNS OK");
      if (result.ssl?.ok) parts.push("SSL OK");
      setMessage(`Domínio sincronizado${parts.length ? `: ${parts.join(" • ")}` : "."}`);
      await refreshAlerts();
    } catch (error) { setMessage(error.message); }
  }

  async function syncApi(serviceId) {
    setMessage("Testando disponibilidade e latência da API…");
    try {
      const result = await send("POST", { serviceId }, "/api/admin/infraestrutura/api/sync");
      const status = result.httpStatus ? `HTTP ${result.httpStatus}` : result.status;
      const latency = Number.isFinite(result.latencyMs) ? ` • ${result.latencyMs} ms` : "";
      setMessage(`API verificada: ${status}${latency}.`);
      await refreshAlerts();
    } catch (error) { setMessage(error.message); }
  }

  async function markPaid(account) {
    const amount = window.prompt("Valor pago", String(account.expected_amount ?? 0));
    if (amount === null) return;
    try { await send("PATCH", { entity: "account", id: account.id, action: "pay", paidAmount: amount, paidOn: isoToday() }); setMessage("Pagamento registrado."); await refreshAlerts(); }
    catch (error) { setMessage(error.message); }
  }

  async function updateAlert(alert, action) {
    try { await send("PATCH", { entity: "alert", id: alert.id, action }); setMessage(action === "resolve" ? "Alerta resolvido." : "Alerta reconhecido."); await load(); }
    catch (error) { setMessage(error.message); }
  }

  async function submitService(event) {
    event.preventDefault();
    const v = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (editingService?.id) {
        await send("PATCH", { entity: "service", id: editingService.id, ...v, autoRenew: v.autoRenew === "on" });
        setMessage("Serviço atualizado.");
      } else {
        await send("POST", { entity: "service", ...v, autoRenew: v.autoRenew === "on" });
        setMessage("Serviço cadastrado.");
      }
      setEditingService(null);
      setForm(null);
      await refreshAlerts();
    } catch (error) { setMessage(error.message); }
  }

  async function submitPlan(event) {
    event.preventDefault();
    const v = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await send("POST", { entity: "plan", ...v, autoRenew: v.autoRenew === "on", consumptionLimits: parseLimits(v.consumptionLimits), isActive: true });
      setForm(null); setMessage("Novo plano ativado; histórico anterior preservado."); await refreshAlerts();
    } catch (error) { setMessage(error.message); }
  }

  async function submitAccount(event) {
    event.preventDefault(); const v = Object.fromEntries(new FormData(event.currentTarget));
    try { await send("POST", { entity: "account", ...v }); setForm(null); setMessage("Conta lançada."); await refreshAlerts(); }
    catch (error) { setMessage(error.message); }
  }

  async function submitConsumption(event) {
    event.preventDefault(); const v = Object.fromEntries(new FormData(event.currentTarget));
    try { await send("POST", { entity: "consumption", ...v, source: "MANUAL" }); setForm(null); setMessage("Consumo registrado."); await refreshAlerts(); }
    catch (error) { setMessage(error.message); }
  }

  const serviceName = (id) => data.services.find((item) => item.id === id)?.name || "—";
  const servicesForTab = ["Domínios", "Supabase", "Vercel", "GitHub", "APIs"].includes(tab) ? data.services.filter((s) => categoryMatch(s, tab)) : data.services;

  function ServiceCards({ services, kind }) {
    return <div className="infra-noc-grid">
      {services.map((service) => {
        const plan = (plansByService.get(service.id) || []).find((item) => item.is_active);
        const expiry = service.expires_on || service.renewal_on || plan?.next_renewal_on;
        const days = daysUntil(expiry);
        return <article className="infra-asset-card" key={service.id}>
          <header><div><span>{service.provider}</span><h3>{service.name}</h3></div><span className={`infra-health ${String(service.health_status || "UNKNOWN").toLowerCase()}`}>{healthLabel(service.health_status)}</span></header>
          <dl>
            <div><dt>Plano</dt><dd>{plan?.plan_name || "Sem plano"}</dd></div>
            <div><dt>Valor</dt><dd>{plan ? money(plan.price, plan.currency) : "—"}</dd></div>
            <div><dt>{kind === "Domínios" ? "Vencimento" : "Renovação"}</dt><dd>{dateBR(expiry)}</dd></div>
            <div><dt>Produto</dt><dd>{service.product_code || "Compartilhado"}</dd></div>
          </dl>
          {expiry && <p className={`infra-expiry ${days !== null && days <= 30 ? "attention" : ""}`}>{days < 0 ? `Vencido há ${Math.abs(days)} dia(s)` : `${days} dia(s) restantes`}{service.auto_renew ? " • renovação automática" : ""}</p>}
          {kind === "Domínios" && service.metadata?.domain && <div className="infra-integration-detail infra-domain-detail"><strong>Domínio</strong><span>{service.metadata.domain.dnsOk ? "DNS ativo" : "DNS não confirmado"} • {service.metadata.domain.sslOk ? "SSL válido" : "SSL não confirmado"}</span><small>{service.metadata.domain.registrar ? `${service.metadata.domain.registrar} • ` : ""}{service.metadata.domain.sslExpiresAt ? `SSL até ${dateBR(service.metadata.domain.sslExpiresAt)}` : "SSL sem vencimento coletado"}{service.last_checked_at ? ` • ${new Date(service.last_checked_at).toLocaleString("pt-BR")}` : ""}</small>{Array.isArray(service.metadata.domain.nameservers) && service.metadata.domain.nameservers.length > 0 && <small>NS: {service.metadata.domain.nameservers.join(", ")}</small>}</div>}
          {service.metadata?.vercel && <div className="infra-integration-detail"><strong>Deploy</strong><span>{service.metadata.vercel.latestState || "—"} • {service.metadata.vercel.gitBranch || "branch —"}</span><small>{service.metadata.vercel.gitCommitSha ? String(service.metadata.vercel.gitCommitSha).slice(0,7) : "sem commit"}{service.last_checked_at ? ` • ${new Date(service.last_checked_at).toLocaleString("pt-BR")}` : ""}</small></div>}
          {service.metadata?.github && <div className="infra-integration-detail"><strong>Repositório</strong><span>{service.metadata.github.defaultBranch || "—"} • {service.metadata.github.visibility || (service.metadata.github.private ? "private" : "public")}</span><small>{service.metadata.github.latestCommitSha ? String(service.metadata.github.latestCommitSha).slice(0,7) : "sem commit"}{service.metadata.github.latestCommitAt ? ` • ${new Date(service.metadata.github.latestCommitAt).toLocaleString("pt-BR")}` : ""}</small></div>}
          {kind === "APIs" && service.metadata?.api && <div className="infra-integration-detail"><strong>Monitor API</strong><span>{service.metadata.api.httpStatus ? `HTTP ${service.metadata.api.httpStatus}` : "Sem resposta"} • {service.metadata.api.latencyMs ?? "—"} ms</span><small>{service.metadata.api.checkedAt ? new Date(service.metadata.api.checkedAt).toLocaleString("pt-BR") : "Ainda não testada"}{service.metadata.api.finalUrl ? ` • ${service.metadata.api.finalUrl}` : ""}</small></div>}
          <footer>
            {categoryMatch(service, "Domínios") && <button type="button" onClick={() => syncDomain(service.id)}>↻ Verificar domínio</button>}
            {String(service.provider || "").toLowerCase().includes("supabase") && <button type="button" onClick={() => syncSupabase(service.id)}>↻ Sincronizar</button>}
            {String(service.provider || "").toLowerCase().includes("vercel") && <button type="button" onClick={() => syncProvider(service.id, "vercel")}>↻ Sincronizar</button>}
            {String(service.provider || "").toLowerCase().includes("github") && <button type="button" onClick={() => syncProvider(service.id, "github")}>↻ Sincronizar</button>}
            {categoryMatch(service, "APIs") && <button type="button" onClick={() => syncApi(service.id)}>↻ Testar API</button>}
            <button type="button" onClick={() => { setEditingService(service); setForm("service"); }}>Editar</button>
            <button type="button" onClick={() => { setSelectedService(service.id); setForm("plan"); }}>{kind === "Domínios" ? "Plano / custo" : "Plano"}</button>
            {service.management_url && <a href={service.management_url} target="_blank" rel="noreferrer">Abrir gestão ↗</a>}
          </footer>
        </article>;
      })}
      {!services.length && <div className="infra-empty-card"><strong>Nenhum item cadastrado.</strong><p>Cadastre o primeiro serviço desta categoria para começar o monitoramento.</p><button type="button" className="root-button root-button-primary" onClick={() => { setEditingService(null); setForm("service"); }}>+ Novo serviço</button></div>}
    </div>;
  }

  return <div className="infra-module">
    <section className="root-section-intro infra-intro">
      <div><span>CENTRO DE CONTROLE DE INFRAESTRUTURA</span><h2>Operação, custos e renovações do ecossistema.</h2><p>Domínios, cloud, código, APIs, planos, consumo e contas em uma única visão ROOT.</p></div>
      <div className="infra-header-actions"><button type="button" className="root-button root-button-secondary" onClick={refreshAlerts}>Recalcular alertas</button><button type="button" className="root-button root-button-primary" onClick={() => { setEditingService(null); setForm("service"); }}>+ Novo serviço</button></div>
    </section>

    <nav className="infra-tabs" aria-label="Áreas de infraestrutura">{TABS.map((item) => <button key={item} type="button" className={tab === item ? "is-active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {message && <div className="infra-message" role="status">{message}</div>}
    {loading && <div className="infra-loading">Carregando infraestrutura…</div>}

    {!loading && tab === "Visão geral" && <>
      <section className="infra-metrics">
        <article><span>Custo mensal equivalente</span><strong>{money(metrics.monthlyEquivalent)}</strong><small>planos recorrentes ativos</small></article>
        <article><span>Renovações em 30 dias</span><strong>{metrics.due30.length}</strong><small>{money(metrics.due30.reduce((s, i) => s + Number(i.expected_amount || 0), 0))}</small></article>
        <article><span>Alertas abertos</span><strong>{openAlerts.length}</strong><small>{openAlerts.filter((a) => a.severity === "CRITICAL").length} crítico(s)</small></article>
        <article><span>Consumo ≥ 80%</span><strong>{metrics.highConsumption.length}</strong><small>métricas em atenção</small></article>
      </section>
      <section className="infra-overview-services">
        {["Domínios", "Supabase", "Vercel", "GitHub", "APIs"].map((kind) => {
          const list = data.services.filter((s) => categoryMatch(s, kind));
          return <button type="button" key={kind} onClick={() => setTab(kind)}><span>{kind}</span><strong>{list.length}</strong><small>{list.filter((s) => s.status === "ACTIVE").length} ativo(s)</small></button>;
        })}
      </section>
      <section className="root-dashboard-grid infra-dashboard-grid">
        <article className="root-panel"><header className="root-panel-header"><div><span>ATIVOS</span><h3>Serviços contratados</h3></div></header><div className="infra-service-list">{data.services.slice(0, 8).map((s) => { const p=(plansByService.get(s.id)||[]).find((x)=>x.is_active); return <div className="infra-service-row" key={s.id}><div><strong>{s.provider}</strong><span>{s.name}</span></div><div><strong>{p?.plan_name || "Sem plano"}</strong><span>{p ? money(p.price,p.currency) : "—"}</span></div><div><strong>{healthLabel(s.health_status)}</strong><span>{dateBR(s.expires_on || s.renewal_on || p?.next_renewal_on)}</span></div></div>; })}{!data.services.length && <p className="infra-empty">Nenhum serviço cadastrado.</p>}</div></article>
        <article className="root-panel"><header className="root-panel-header"><div><span>ALERTAS</span><h3>Prioridades operacionais</h3></div></header><div className="infra-alert-list">{openAlerts.slice(0, 8).map((a)=><div key={a.id} className={`infra-alert ${a.severity === "CRITICAL" ? "critical" : "warning"}`}><b>{a.severity === "CRITICAL" ? "!" : "↗"}</b><span><strong>{a.title}</strong><small>{a.message || "Requer atenção"}</small></span></div>)}{!openAlerts.length && <p className="infra-empty">Nenhum alerta aberto.</p>}</div></article>
      </section>
    </>}

    {!loading && ["Domínios", "Supabase", "Vercel", "GitHub", "APIs"].includes(tab) && <section className="root-panel infra-catalog-panel"><header className="root-panel-header"><div><span>{tab.toUpperCase()}</span><h3>{tab === "Domínios" ? "Domínios, vencimentos e renovação" : `${tab} — ativos monitorados`}</h3></div></header><ServiceCards services={servicesForTab} kind={tab} />{tab === "Supabase" && <ConsumptionPanel items={latestConsumption.filter((i) => servicesForTab.some((s)=>s.id===i.service_id))} serviceName={serviceName} />}</section>}

    {!loading && tab === "Serviços" && <section className="root-panel infra-table-panel"><header className="root-panel-header infra-panel-actions"><div><span>CATÁLOGO</span><h3>Serviços e histórico de planos</h3></div><button type="button" className="root-button root-button-primary" onClick={() => setForm("plan")}>+ Alterar / contratar plano</button></header><div className="root-table-wrap"><table className="root-table infra-table"><thead><tr><th>Fornecedor / serviço</th><th>Categoria</th><th>Produto</th><th>Plano atual</th><th>Valor</th><th>Renovação</th><th>Saúde</th></tr></thead><tbody>{data.services.map((s)=>{const p=(plansByService.get(s.id)||[]).find((x)=>x.is_active); return <tr key={s.id}><td><strong>{s.provider}</strong><small>{s.name}</small></td><td>{s.category}</td><td>{s.product_code||"Compartilhado"}</td><td>{p?.plan_name||"—"}</td><td>{p?money(p.price,p.currency):"—"}</td><td>{dateBR(s.renewal_on||p?.next_renewal_on)}</td><td><span className={`infra-badge ${s.health_status === "ONLINE" ? "paid" : "neutral"}`}>{healthLabel(s.health_status)}</span></td></tr>})}</tbody></table></div></section>}

    {!loading && tab === "Contas" && <section className="root-panel infra-table-panel"><header className="root-panel-header infra-panel-actions"><div><span>CONTAS A PAGAR</span><h3>Obrigações de infraestrutura</h3></div><div className="infra-header-actions"><button type="button" className="root-button root-button-secondary" onClick={generatePayables}>Gerar próximas cobranças</button><button type="button" className="root-button root-button-primary" onClick={() => setForm("account")}>+ Lançamento manual</button></div></header><div className="root-table-wrap"><table className="root-table infra-table"><thead><tr><th>Descrição</th><th>Origem</th><th>Produto</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>{data.accounts.map((a)=>{const d=daysUntil(a.due_on); const label=a.status==="PAID"?"Pago":a.status==="CANCELLED"?"Cancelado":d<0?"Vencido":d===0?"Vence hoje":d<=7?"A vencer":"Previsto"; const cls=a.status==="PAID"?"paid":d<0?"critical":d<=7?"warning":"open"; return <tr key={a.id}><td><strong>{a.description}</strong><small>{serviceName(a.service_id)}</small></td><td>{a.source}</td><td>{a.product_code||"—"}</td><td>{dateBR(a.due_on)}</td><td>{money(a.status==="PAID"?a.paid_amount:a.expected_amount)}</td><td><span className={`infra-badge ${cls}`}>{label}</span></td><td>{a.status==="OPEN"?<button type="button" className="infra-link-button" onClick={()=>markPaid(a)}>Marcar pago</button>:"—"}</td></tr>})}</tbody></table></div></section>}

    {!loading && tab === "Alertas" && <section className="root-panel infra-table-panel"><header className="root-panel-header infra-panel-actions"><div><span>CENTRAL DE ALERTAS</span><h3>Vencimentos, custos e limites</h3></div><button type="button" className="root-button root-button-secondary" onClick={refreshAlerts}>↻ Recalcular</button></header><div className="infra-alerts-full">{data.alerts.map((a)=><article key={a.id} className={`infra-alert-card ${String(a.severity).toLowerCase()}`}><div><span>{a.severity}</span><h4>{a.title}</h4><p>{a.message||"—"}</p><small>{new Date(a.detected_at).toLocaleString("pt-BR")} • {a.source}</small></div><div className="infra-alert-actions"><span className={`infra-badge ${a.status === "OPEN" ? "warning" : a.status === "RESOLVED" ? "paid" : "neutral"}`}>{a.status}</span>{a.status === "OPEN" && <button type="button" onClick={()=>updateAlert(a,"acknowledge")}>Ciente</button>}{a.status !== "RESOLVED" && <button type="button" onClick={()=>updateAlert(a,"resolve")}>Resolver</button>}</div></article>)}{!data.alerts.length&&<p className="infra-empty">Nenhum alerta registrado.</p>}</div></section>}

    {form && <div className="infra-modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setForm(null)}}><section className="infra-modal" role="dialog" aria-modal="true"><header><div><span>PLENIUM ROOT</span><h3>{form === "service" ? (editingService ? "Editar serviço / ativo" : "Novo serviço / ativo") : form === "plan" ? "Novo plano / alteração" : form === "account" ? "Lançamento manual" : "Registrar consumo"}</h3></div><button type="button" onClick={()=>{setEditingService(null);setForm(null)}} aria-label="Fechar">×</button></header>
      {form === "service" && <form onSubmit={submitService} className="infra-form"><label>Fornecedor<input name="provider" required placeholder="Ex.: Registro.br" defaultValue={editingService?.provider || ""} /></label><label>Serviço / ativo<input name="name" required placeholder="Ex.: pleniumgestao.com.br" defaultValue={editingService?.name || ""} /></label><label>Categoria<select name="category" defaultValue={editingService?.category || "DOMINIO"}><option value="DOMINIO">Domínio</option><option value="BANCO_DADOS">Banco de dados</option><option value="HOSPEDAGEM">Hospedagem</option><option value="DESENVOLVIMENTO">Desenvolvimento / código</option><option value="API">API</option><option value="IA">IA</option><option value="EMAIL">E-mail</option><option value="OUTRO">Outro</option></select></label><label>Produto<select name="productCode" defaultValue={editingService?.product_code || ""}><option value="">Compartilhado</option>{PRODUCT_OPTIONS.map((p)=><option key={p}>{p}</option>)}</select></label><label>Identificador<input name="resourceIdentifier" placeholder="domínio, project ref, repositório..." defaultValue={editingService?.resource_identifier || ""} /></label><label>URL de gestão<input name="managementUrl" type="url" placeholder="https://..." defaultValue={editingService?.management_url || ""} /></label><label>Início / contratação<input name="startedOn" type="date" defaultValue={editingService?.started_on ? String(editingService.started_on).slice(0,10) : ""} /></label><label>Vencimento<input name="expiresOn" type="date" defaultValue={editingService?.expires_on ? String(editingService.expires_on).slice(0,10) : ""} /></label><label>Próxima renovação<input name="renewalOn" type="date" defaultValue={editingService?.renewal_on ? String(editingService.renewal_on).slice(0,10) : ""} /></label><label>Saúde inicial<select name="healthStatus" defaultValue={editingService?.health_status || "UNKNOWN"}><option value="UNKNOWN">Não verificado</option><option value="ONLINE">Online</option><option value="ATTENTION">Atenção</option><option value="DEGRADED">Degradado</option><option value="OFFLINE">Offline</option></select></label><label className="infra-check"><input name="autoRenew" type="checkbox" defaultChecked={Boolean(editingService?.auto_renew)} /> Renovação automática</label><label className="infra-span-2">Observações<textarea name="notes" rows="3" defaultValue={editingService?.notes || ""} /></label><div className="infra-form-actions"><button type="button" className="root-button root-button-secondary" onClick={()=>{setEditingService(null);setForm(null)}}>Cancelar</button><button className="root-button root-button-primary">{editingService ? "Salvar alterações" : "Salvar serviço"}</button></div></form>}
      {form === "plan" && <form onSubmit={submitPlan} className="infra-form"><label>Serviço<select name="serviceId" required value={selectedService} onChange={(e)=>setSelectedService(e.target.value)}>{data.services.map((s)=><option key={s.id} value={s.id}>{s.provider} — {s.name}</option>)}</select></label><label>Nome do plano<input name="planName" required placeholder="Free, Pro, Enterprise..." /></label><label>Valor<input name="price" type="number" min="0" step="0.01" defaultValue="0" /></label><label>Periodicidade<select name="billingCycle"><option value="FREE">Gratuito</option><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option><option value="SEMIANNUAL">Semestral</option><option value="ANNUAL">Anual</option><option value="BIENNIAL">Bienal</option><option value="USAGE">Por consumo</option><option value="OTHER">Outro</option></select></label><label>Início da vigência<input name="startsOn" type="date" defaultValue={isoToday()} required /></label><label>Próxima renovação<input name="nextRenewalOn" type="date" /></label><label className="infra-check"><input name="autoRenew" type="checkbox" /> Renovação automática</label><label className="infra-span-2">Limites de consumo<textarea name="consumptionLimits" rows="4" placeholder={"database_size_gb=0.5\nstorage_size_gb=1\napi_rest_requests=500000"} /><small>Uma métrica por linha: chave=limite.</small></label><label className="infra-span-2">Observações<textarea name="notes" rows="3" /></label><div className="infra-form-actions"><button type="button" className="root-button root-button-secondary" onClick={()=>setForm(null)}>Cancelar</button><button className="root-button root-button-primary">Ativar plano</button></div></form>}
      {form === "account" && <form onSubmit={submitAccount} className="infra-form"><label className="infra-span-2">Descrição<input name="description" required /></label><label>Serviço<select name="serviceId"><option value="">Sem vínculo</option>{data.services.map((s)=><option key={s.id} value={s.id}>{s.provider} — {s.name}</option>)}</select></label><label>Produto<select name="productCode"><option value="">Não definido</option>{PRODUCT_OPTIONS.map((p)=><option key={p}>{p}</option>)}</select></label><label>Vencimento<input name="dueOn" type="date" required /></label><label>Valor previsto<input name="expectedAmount" type="number" min="0" step="0.01" required /></label><label>Recorrência<select name="recurrence"><option value="NONE">Não recorrente</option><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option><option value="SEMIANNUAL">Semestral</option><option value="ANNUAL">Anual</option><option value="BIENNIAL">Bienal</option><option value="OTHER">Outra</option></select></label><label>Forma de pagamento<input name="paymentMethod" /></label><label className="infra-span-2">Observações<textarea name="notes" rows="3" /></label><div className="infra-form-actions"><button type="button" className="root-button root-button-secondary" onClick={()=>setForm(null)}>Cancelar</button><button className="root-button root-button-primary">Lançar conta</button></div></form>}
    </section></div>}
  </div>;
}

function ConsumptionPanel({ items, serviceName }) {
  if (!items.length) return <div className="infra-consumption-inline"><p className="infra-empty">Ainda não há métricas coletadas para este serviço.</p></div>;
  return <div className="infra-consumption-inline"><h4>Consumo atual</h4><div className="infra-consumption-grid">{items.map((item)=>{const pct=consumptionPercent(item); return <article key={`${item.service_id}:${item.metric_key}`}><div><span>{serviceName(item.service_id)}</span><strong>{item.metric_label}</strong></div><p>{Number(item.used_value).toLocaleString("pt-BR")} <small>{item.unit}</small>{item.limit_value!==null&&<><em>/</em> {Number(item.limit_value).toLocaleString("pt-BR")} <small>{item.unit}</small></>}</p>{pct!==null&&<div className="infra-progress"><span style={{width:`${Math.min(pct,100)}%`}}/><small>{pct.toFixed(1)}%</small></div>}<footer><span>{item.source}</span><small>{new Date(item.measured_at).toLocaleString("pt-BR")}</small></footer></article>})}</div></div>;
}
