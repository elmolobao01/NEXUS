"use client";

import { useEffect, useMemo, useState } from "react";

const TABS = ["Visão geral", "Serviços e planos", "Contas a pagar", "Consumo"];
const PRODUCT_OPTIONS = ["PLENIUM", "SIGEE", "ALÔ ID", "Compartilhado", "Outro"];

function money(value, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value || 0));
}

function dateBR(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(date) {
  if (!date) return null;
  const today = new Date(`${isoToday()}T00:00:00Z`);
  const target = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  return Math.ceil((target - today) / 86400000);
}

function accountVisualStatus(account) {
  if (account.status === "PAID") return { label: "Pago", className: "paid" };
  if (account.status === "CANCELLED") return { label: "Cancelado", className: "neutral" };
  const days = daysUntil(account.due_on);
  if (days < 0) return { label: "Vencido", className: "critical" };
  if (days === 0) return { label: "Vence hoje", className: "warning" };
  if (days <= 7) return { label: "A vencer", className: "warning" };
  return { label: "Previsto", className: "open" };
}

function consumptionPercent(item) {
  const limit = Number(item.limit_value || 0);
  if (!limit) return null;
  return Math.max(0, (Number(item.used_value || 0) / limit) * 100);
}

export default function InfrastructureSection() {
  const [tab, setTab] = useState("Visão geral");
  const [data, setData] = useState({ services: [], plans: [], accounts: [], consumption: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(null);
  const [selectedService, setSelectedService] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/infraestrutura", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Falha ao carregar infraestrutura.");
      setData(payload);
      if (!selectedService && payload.services?.[0]?.id) setSelectedService(payload.services[0].id);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const plansByService = useMemo(() => {
    const map = new Map();
    for (const plan of data.plans) {
      if (!map.has(plan.service_id)) map.set(plan.service_id, []);
      map.get(plan.service_id).push(plan);
    }
    return map;
  }, [data.plans]);

  const activePlans = useMemo(() => data.plans.filter((item) => item.is_active), [data.plans]);

  const latestConsumption = useMemo(() => {
    const map = new Map();
    for (const item of data.consumption) {
      const key = `${item.service_id}:${item.metric_key}`;
      if (!map.has(key)) map.set(key, item);
    }
    return [...map.values()];
  }, [data.consumption]);

  const metrics = useMemo(() => {
    const openAccounts = data.accounts.filter((item) => item.status === "OPEN");
    const monthlyEquivalent = activePlans.reduce((sum, plan) => {
      const price = Number(plan.price || 0);
      if (plan.billing_cycle === "MONTHLY") return sum + price;
      if (plan.billing_cycle === "QUARTERLY") return sum + price / 3;
      if (plan.billing_cycle === "SEMIANNUAL") return sum + price / 6;
      if (plan.billing_cycle === "ANNUAL") return sum + price / 12;
      if (plan.billing_cycle === "BIENNIAL") return sum + price / 24;
      return sum;
    }, 0);
    const due30 = openAccounts.filter((item) => {
      const d = daysUntil(item.due_on);
      return d !== null && d >= 0 && d <= 30;
    });
    const overdue = openAccounts.filter((item) => daysUntil(item.due_on) < 0);
    const highConsumption = latestConsumption.filter((item) => (consumptionPercent(item) || 0) >= 80);
    return { monthlyEquivalent, due30, overdue, highConsumption };
  }, [activePlans, data.accounts, latestConsumption]);

  async function post(body) {
    setMessage("");
    const response = await fetch("/api/admin/infraestrutura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Operação não concluída.");
    return payload;
  }

  async function patch(body) {
    setMessage("");
    const response = await fetch("/api/admin/infraestrutura", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Operação não concluída.");
    return payload;
  }

  async function submitService(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await post({ entity: "service", ...values });
      setForm(null); setMessage("Serviço cadastrado com sucesso."); await load();
    } catch (error) { setMessage(error.message); }
  }

  async function submitPlan(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await post({
        entity: "plan",
        ...values,
        autoRenew: values.autoRenew === "on",
        isActive: true,
      });
      setForm(null); setMessage("Novo plano ativado e histórico preservado."); await load();
    } catch (error) { setMessage(error.message); }
  }

  async function submitAccount(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await post({ entity: "account", ...values });
      setForm(null); setMessage("Conta a pagar lançada."); await load();
    } catch (error) { setMessage(error.message); }
  }

  async function submitConsumption(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await post({ entity: "consumption", ...values, source: "MANUAL" });
      setForm(null); setMessage("Consumo registrado."); await load();
    } catch (error) { setMessage(error.message); }
  }

  async function markPaid(account) {
    const amount = window.prompt("Valor pago", String(account.expected_amount ?? 0));
    if (amount === null) return;
    try {
      await patch({ entity: "account", id: account.id, action: "pay", paidAmount: amount, paidOn: isoToday() });
      setMessage("Pagamento registrado."); await load();
    } catch (error) { setMessage(error.message); }
  }

  async function generatePayables() {
    const until = new Date();
    until.setMonth(until.getMonth() + 12);
    try {
      const payload = await post({ entity: "generate-payables", until: until.toISOString().slice(0, 10) });
      setMessage(`${payload.generated || 0} cobrança(s) nova(s) gerada(s) para os próximos 12 meses.`);
      await load();
    } catch (error) { setMessage(error.message); }
  }

  function serviceName(id) {
    return data.services.find((item) => item.id === id)?.name || "—";
  }

  return (
    <div className="infra-module">
      <section className="root-section-intro infra-intro">
        <div>
          <span>INFRAESTRUTURA & ASSINATURAS</span>
          <h2>Custos, planos, consumo e renovações em um só lugar.</h2>
          <p>Controle manualmente seus ativos tecnológicos hoje e conecte APIs de consumo quando o fornecedor permitir.</p>
        </div>
        <div className="infra-header-actions">
          <button type="button" className="root-button root-button-secondary" onClick={generatePayables}>Gerar cobranças</button>
          <button type="button" className="root-button root-button-primary" onClick={() => setForm("service")}>+ Novo serviço</button>
        </div>
      </section>

      <div className="infra-tabs" role="tablist" aria-label="Infraestrutura">
        {TABS.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "is-active" : ""} onClick={() => setTab(item)}>{item}</button>)}
      </div>

      {message && <div className="infra-message" role="status">{message}</div>}
      {loading && <div className="infra-loading">Carregando dados de infraestrutura…</div>}

      {!loading && tab === "Visão geral" && (
        <>
          <section className="infra-metrics">
            <article><span>Custo mensal equivalente</span><strong>{money(metrics.monthlyEquivalent)}</strong><small>planos ativos recorrentes</small></article>
            <article><span>Renovações em 30 dias</span><strong>{metrics.due30.length}</strong><small>{money(metrics.due30.reduce((s, i) => s + Number(i.expected_amount || 0), 0))}</small></article>
            <article><span>Contas vencidas</span><strong>{metrics.overdue.length}</strong><small>{metrics.overdue.length ? "exigem atenção" : "nenhuma pendência"}</small></article>
            <article><span>Consumo ≥ 80%</span><strong>{metrics.highConsumption.length}</strong><small>métricas em atenção</small></article>
          </section>

          <section className="root-dashboard-grid infra-dashboard-grid">
            <article className="root-panel">
              <header className="root-panel-header"><div><span>SERVIÇOS ATIVOS</span><h3>Planos contratados</h3></div></header>
              <div className="infra-service-list">
                {data.services.length === 0 && <p className="infra-empty">Cadastre o primeiro serviço, como Supabase, Vercel ou Registro.br.</p>}
                {data.services.map((service) => {
                  const plan = (plansByService.get(service.id) || []).find((item) => item.is_active);
                  return <div className="infra-service-row" key={service.id}>
                    <div><strong>{service.provider}</strong><span>{service.name}{service.product_code ? ` • ${service.product_code}` : ""}</span></div>
                    <div><strong>{plan?.plan_name || "Sem plano"}</strong><span>{plan ? `${money(plan.price, plan.currency)} • ${plan.billing_cycle}` : "Cadastre a contratação"}</span></div>
                    <div><strong>{dateBR(plan?.next_renewal_on)}</strong><span>próxima renovação</span></div>
                  </div>;
                })}
              </div>
            </article>

            <article className="root-panel">
              <header className="root-panel-header"><div><span>PRÓXIMOS EVENTOS</span><h3>Renovações e consumo</h3></div></header>
              <div className="infra-alert-list">
                {metrics.overdue.slice(0, 3).map((item) => <div key={item.id} className="infra-alert critical"><b>!</b><span><strong>{item.description}</strong><small>Venceu em {dateBR(item.due_on)} • {money(item.expected_amount)}</small></span></div>)}
                {metrics.due30.slice(0, 4).map((item) => <div key={item.id} className="infra-alert warning"><b>↗</b><span><strong>{item.description}</strong><small>{dateBR(item.due_on)} • {money(item.expected_amount)}</small></span></div>)}
                {metrics.highConsumption.slice(0, 4).map((item) => <div key={item.id} className="infra-alert warning"><b>%</b><span><strong>{serviceName(item.service_id)} • {item.metric_label}</strong><small>{consumptionPercent(item).toFixed(1)}% do limite</small></span></div>)}
                {!metrics.overdue.length && !metrics.due30.length && !metrics.highConsumption.length && <p className="infra-empty">Nenhum alerta crítico no momento.</p>}
              </div>
            </article>
          </section>
        </>
      )}

      {!loading && tab === "Serviços e planos" && (
        <section className="root-panel infra-table-panel">
          <header className="root-panel-header infra-panel-actions"><div><span>CATÁLOGO DE INFRAESTRUTURA</span><h3>Serviços e histórico de planos</h3></div><button type="button" className="root-button root-button-primary" onClick={() => setForm("plan")}>+ Alterar / contratar plano</button></header>
          <div className="root-table-wrap"><table className="root-table infra-table"><thead><tr><th>Fornecedor / serviço</th><th>Produto</th><th>Plano atual</th><th>Valor</th><th>Vigência</th><th>Renovação</th><th>Status</th></tr></thead><tbody>
            {data.services.map((service) => {
              const plan = (plansByService.get(service.id) || []).find((item) => item.is_active);
              return <tr key={service.id}><td><strong>{service.provider}</strong><small>{service.name}{service.resource_identifier ? ` • ${service.resource_identifier}` : ""}</small></td><td>{service.product_code || "Compartilhado"}</td><td>{plan?.plan_name || "—"}</td><td>{plan ? money(plan.price, plan.currency) : "—"}</td><td>{plan ? `desde ${dateBR(plan.starts_on)}` : "—"}</td><td>{dateBR(plan?.next_renewal_on)}</td><td><span className={`infra-badge ${service.status === "ACTIVE" ? "paid" : "neutral"}`}>{service.status === "ACTIVE" ? "Ativo" : service.status}</span></td></tr>;
            })}
          </tbody></table></div>

          {selectedService && (plansByService.get(selectedService) || []).length > 0 && <div className="infra-history"><strong>Histórico de planos</strong><select value={selectedService} onChange={(e) => setSelectedService(e.target.value)}>{data.services.map((s) => <option value={s.id} key={s.id}>{s.provider} — {s.name}</option>)}</select><div>{(plansByService.get(selectedService) || []).map((plan) => <span key={plan.id}>{plan.plan_name} • {money(plan.price, plan.currency)} • {dateBR(plan.starts_on)} → {plan.is_active ? "atual" : dateBR(plan.ends_on)}</span>)}</div></div>}
        </section>
      )}

      {!loading && tab === "Contas a pagar" && (
        <section className="root-panel infra-table-panel">
          <header className="root-panel-header infra-panel-actions"><div><span>CONTAS A PAGAR</span><h3>Obrigações de infraestrutura</h3></div><button type="button" className="root-button root-button-primary" onClick={() => setForm("account")}>+ Lançamento manual</button></header>
          <div className="root-table-wrap"><table className="root-table infra-table"><thead><tr><th>Descrição</th><th>Origem</th><th>Produto</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>
            {data.accounts.map((account) => { const status = accountVisualStatus(account); return <tr key={account.id}><td><strong>{account.description}</strong><small>{serviceName(account.service_id)}</small></td><td>{account.source === "MANUAL" ? "Manual" : account.source === "PLAN" ? "Plano" : "Integração"}</td><td>{account.product_code || "—"}</td><td>{dateBR(account.due_on)}</td><td>{money(account.status === "PAID" ? account.paid_amount : account.expected_amount)}</td><td><span className={`infra-badge ${status.className}`}>{status.label}</span></td><td>{account.status === "OPEN" ? <button type="button" className="infra-link-button" onClick={() => markPaid(account)}>Marcar pago</button> : "—"}</td></tr>; })}
          </tbody></table></div>
        </section>
      )}

      {!loading && tab === "Consumo" && (
        <section className="root-panel infra-table-panel">
          <header className="root-panel-header infra-panel-actions"><div><span>CONSUMO</span><h3>Métricas atuais por serviço</h3></div><button type="button" className="root-button root-button-primary" onClick={() => setForm("consumption")}>+ Registrar consumo</button></header>
          <div className="infra-consumption-grid">
            {latestConsumption.map((item) => { const pct = consumptionPercent(item); return <article key={`${item.service_id}:${item.metric_key}`}><div><span>{serviceName(item.service_id)}</span><strong>{item.metric_label}</strong></div><p>{Number(item.used_value).toLocaleString("pt-BR")} <small>{item.unit}</small>{item.limit_value !== null ? <><em>/</em> {Number(item.limit_value).toLocaleString("pt-BR")} <small>{item.unit}</small></> : null}</p>{pct !== null && <div className="infra-progress"><span style={{ width: `${Math.min(pct, 100)}%` }} /><small>{pct.toFixed(1)}%</small></div>}<footer><span>{item.source}</span><small>{new Date(item.measured_at).toLocaleString("pt-BR")}</small></footer></article>; })}
            {!latestConsumption.length && <p className="infra-empty">Nenhuma métrica registrada. Comece manualmente; depois conectaremos APIs.</p>}
          </div>
        </section>
      )}

      {form && <div className="infra-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setForm(null); }}><section className="infra-modal" role="dialog" aria-modal="true" aria-label="Cadastro de infraestrutura"><header><div><span>PLENIUM ROOT</span><h3>{form === "service" ? "Novo serviço" : form === "plan" ? "Novo plano / alteração" : form === "account" ? "Lançamento manual" : "Registrar consumo"}</h3></div><button type="button" onClick={() => setForm(null)} aria-label="Fechar">×</button></header>
        {form === "service" && <form onSubmit={submitService} className="infra-form"><label>Fornecedor<input name="provider" required placeholder="Ex.: Supabase" /></label><label>Serviço / ativo<input name="name" required placeholder="Ex.: Banco PLENIUM" /></label><label>Categoria<select name="category"><option value="BANCO_DADOS">Banco de dados</option><option value="HOSPEDAGEM">Hospedagem</option><option value="DOMINIO">Domínio</option><option value="IA">IA / API</option><option value="EMAIL">E-mail</option><option value="DESENVOLVIMENTO">Desenvolvimento</option><option value="OUTRO">Outro</option></select></label><label>Produto<select name="productCode"><option value="">Compartilhado</option>{PRODUCT_OPTIONS.map((p) => <option key={p}>{p}</option>)}</select></label><label>Identificador<input name="resourceIdentifier" placeholder="domínio, projeto, workspace..." /></label><label>URL de gestão<input name="managementUrl" type="url" placeholder="https://..." /></label><label className="infra-span-2">Observações<textarea name="notes" rows="3" /></label><div className="infra-form-actions"><button type="button" className="root-button root-button-secondary" onClick={() => setForm(null)}>Cancelar</button><button className="root-button root-button-primary">Salvar serviço</button></div></form>}
        {form === "plan" && <form onSubmit={submitPlan} className="infra-form"><label>Serviço<select name="serviceId" required defaultValue={selectedService}>{data.services.map((s) => <option key={s.id} value={s.id}>{s.provider} — {s.name}</option>)}</select></label><label>Nome do plano<input name="planName" required placeholder="Free, Pro, Enterprise..." /></label><label>Valor<input name="price" type="number" min="0" step="0.01" defaultValue="0" /></label><label>Periodicidade<select name="billingCycle"><option value="FREE">Gratuito</option><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option><option value="SEMIANNUAL">Semestral</option><option value="ANNUAL">Anual</option><option value="BIENNIAL">Bienal</option><option value="USAGE">Por consumo</option><option value="OTHER">Outro</option></select></label><label>Início da vigência<input name="startsOn" type="date" defaultValue={isoToday()} required /></label><label>Próxima renovação<input name="nextRenewalOn" type="date" /></label><label className="infra-check"><input name="autoRenew" type="checkbox" /> Renovação automática</label><label className="infra-span-2">Observações<textarea name="notes" rows="3" placeholder="Inclua limites, condições comerciais e detalhes do contrato." /></label><div className="infra-form-actions"><button type="button" className="root-button root-button-secondary" onClick={() => setForm(null)}>Cancelar</button><button className="root-button root-button-primary">Ativar novo plano</button></div></form>}
        {form === "account" && <form onSubmit={submitAccount} className="infra-form"><label className="infra-span-2">Descrição<input name="description" required placeholder="Ex.: Renovação do domínio pleniumgestao.com.br" /></label><label>Serviço<select name="serviceId"><option value="">Sem vínculo</option>{data.services.map((s) => <option key={s.id} value={s.id}>{s.provider} — {s.name}</option>)}</select></label><label>Produto<select name="productCode"><option value="">Não definido</option>{PRODUCT_OPTIONS.map((p) => <option key={p}>{p}</option>)}</select></label><label>Vencimento<input name="dueOn" type="date" required /></label><label>Valor previsto<input name="expectedAmount" type="number" min="0" step="0.01" required /></label><label>Recorrência<select name="recurrence"><option value="NONE">Não recorrente</option><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option><option value="SEMIANNUAL">Semestral</option><option value="ANNUAL">Anual</option><option value="BIENNIAL">Bienal</option><option value="OTHER">Outra</option></select></label><label>Forma de pagamento<input name="paymentMethod" placeholder="Cartão, PIX, boleto..." /></label><label className="infra-span-2">Observações<textarea name="notes" rows="3" /></label><div className="infra-form-actions"><button type="button" className="root-button root-button-secondary" onClick={() => setForm(null)}>Cancelar</button><button className="root-button root-button-primary">Lançar conta</button></div></form>}
        {form === "consumption" && <form onSubmit={submitConsumption} className="infra-form"><label>Serviço<select name="serviceId" required>{data.services.map((s) => <option key={s.id} value={s.id}>{s.provider} — {s.name}</option>)}</select></label><label>Métrica<input name="metricLabel" required placeholder="Ex.: Database size" /></label><label>Chave técnica<input name="metricKey" required placeholder="database_size" /></label><label>Unidade<input name="unit" defaultValue="GB" /></label><label>Consumo atual<input name="usedValue" type="number" min="0" step="0.0001" required /></label><label>Limite do plano<input name="limitValue" type="number" min="0" step="0.0001" /></label><label>Custo estimado<input name="estimatedCost" type="number" min="0" step="0.01" /></label><div className="infra-form-actions"><button type="button" className="root-button root-button-secondary" onClick={() => setForm(null)}>Cancelar</button><button className="root-button root-button-primary">Registrar leitura</button></div></form>}
      </section></div>}
    </div>
  );
}
