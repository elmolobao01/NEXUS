"use client";

import { useEffect, useMemo, useState } from "react";

const levels = [
  { id: 0, name: "L0", label: "Local / Free" },
  { id: 1, name: "L1", label: "Ultra Economy" },
  { id: 2, name: "L2", label: "Economy" },
  { id: 3, name: "L3", label: "Advanced" },
  { id: 4, name: "L4", label: "Critical" },
];

function usd(value, digits = 4) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value || 0));
}
function pct(value) { return `${Number(value || 0).toFixed(1).replace(".", ",")}%`; }
function levelName(value) { return levels.find((item) => item.id === Number(value))?.name || `L${value}`; }

export default function AISection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Visão geral");
  const [busy, setBusy] = useState("");
  const [routeForm, setRouteForm] = useState({ operationType: "*", level: 1, modelId: "", fallbackModelId: "", minQualityScore: 0 });
  const [limitForm, setLimitForm] = useState({ organizationId: "", operationType: "*", monthlyOperations: "500", monthlyCostUsd: "", hardLimit: true });

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/ai", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Falha ao carregar PLENIUM AI.");
      setData(payload);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function patch(entity, id, changes) {
    setBusy(`${entity}:${id}`); setError("");
    try {
      const response = await fetch("/api/admin/ai", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, id, ...changes }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Não foi possível salvar.");
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  async function post(body) {
    setBusy("create"); setError("");
    try {
      const response = await fetch("/api/admin/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Não foi possível salvar.");
      await load();
      return true;
    } catch (err) { setError(err.message); return false; }
    finally { setBusy(""); }
  }

  const providerMap = useMemo(() => Object.fromEntries((data?.providers || []).map((item) => [item.id, item])), [data]);
  const modelMap = useMemo(() => Object.fromEntries((data?.models || []).map((item) => [item.id, item])), [data]);
  const organizationMap = useMemo(() => Object.fromEntries((data?.organizations || []).map((item) => [item.id, item])), [data]);

  if (loading) return <section className="ai2-loading">Carregando PLENIUM AI Engine…</section>;

  return (
    <div className="ai2-shell">
      <section className="ai2-hero">
        <div>
          <span>PLENIUM AI ENGINE · v0.2</span>
          <h2>Controle a inteligência e preserve a margem.</h2>
          <p>Administre providers, modelos, níveis L0–L4, rotas, consumo, limites e custo real sem expor fornecedores aos clientes.</p>
        </div>
        <div className="ai2-engine-state">
          <span className="ai2-live-dot" />
          <div><strong>AI Router operacional</strong><small>{(data?.providers || []).filter((item) => item.active).length} provider(s) ativo(s)</small></div>
        </div>
      </section>

      {error && <div className="ai2-error">{error}</div>}
      {!data?.serviceRoleConfigured && <div className="ai2-warning">Leitura liberada. Para ativar/desativar providers e editar custos, configure <strong>SUPABASE_SERVICE_ROLE_KEY</strong> na Vercel.</div>}

      <section className="ai2-metrics">
        <article><span>Operações observadas</span><strong>{data?.metrics?.operations || 0}</strong><small>últimas 250 operações</small></article>
        <article><span>Taxa de sucesso</span><strong>{pct(data?.metrics?.successRate)}</strong><small>execuções concluídas</small></article>
        <article><span>Custo de IA</span><strong>{usd(data?.metrics?.totalCostUsd)}</strong><small>custo bruto registrado</small></article>
        <article><span>Margem de IA</span><strong>{pct(data?.metrics?.marginRate)}</strong><small>{usd(data?.metrics?.marginUsd)} acumulados</small></article>
        <article><span>Fallback</span><strong>{pct(data?.metrics?.fallbackRate)}</strong><small>troca automática de modelo</small></article>
      </section>

      <div className="ai2-tabs">
        {["Visão geral", "Providers", "Modelos", "Rotas", "Consumo", "Limites"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}
      </div>

      {tab === "Visão geral" && (
        <section className="ai2-grid">
          <article className="ai2-panel">
            <header><div><span>ROTEAMENTO</span><h3>Níveis de inteligência</h3></div></header>
            <div className="ai2-levels">{levels.map((item) => {
              const models = (data?.models || []).filter((model) => Number(model.level) === item.id && model.active);
              return <div key={item.id}><strong>{item.name}</strong><span>{item.label}</span><small>{models.length} modelo(s) ativo(s)</small></div>;
            })}</div>
          </article>
          <article className="ai2-panel">
            <header><div><span>ESTRATÉGIA</span><h3>Princípios do Engine</h3></div></header>
            <ul className="ai2-principles"><li>✓ O cliente compra capacidade PLENIUM AI, não fornecedor.</li><li>✓ Toda chamada passa pelo AI Router central.</li><li>✓ O menor custo só vence quando atinge a qualidade mínima.</li><li>✓ L4 pode exigir validação ou fallback antes da entrega.</li><li>✓ Consumo e margem são registrados por organização.</li></ul>
          </article>
        </section>
      )}

      {tab === "Providers" && <section className="ai2-panel"><header><div><span>FORNECEDORES</span><h3>Providers conectáveis</h3></div></header><div className="ai2-table-wrap"><table><thead><tr><th>Provider</th><th>Código</th><th>Prioridade</th><th>Status</th><th>Ação</th></tr></thead><tbody>{(data?.providers || []).map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.code}</td><td>{item.priority}</td><td><span className={`ai2-status ${item.active ? "on" : "off"}`}>{item.active ? "Ativo" : "Inativo"}</span></td><td><button disabled={busy === `provider:${item.id}`} onClick={() => patch("provider", item.id, { active: !item.active })}>{item.active ? "Desativar" : "Ativar"}</button></td></tr>)}</tbody></table></div></section>}

      {tab === "Modelos" && <section className="ai2-panel"><header><div><span>CATÁLOGO</span><h3>Modelos e custo de inferência</h3></div></header><div className="ai2-table-wrap"><table><thead><tr><th>Modelo</th><th>Provider</th><th>Nível</th><th>Input / 1M</th><th>Output / 1M</th><th>Status</th></tr></thead><tbody>{(data?.models || []).map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.code}</small></td><td>{item.provider?.name || providerMap[item.provider_id]?.name || "—"}</td><td><span className="ai2-level-pill">{levelName(item.level)}</span></td><td>{usd(item.input_cost_per_million, 3)}</td><td>{usd(item.output_cost_per_million, 3)}</td><td><div className="ai2-actions"><button onClick={() => { const input = window.prompt("Custo de entrada por 1M tokens (USD)", item.input_cost_per_million); if (input === null) return; const output = window.prompt("Custo de saída por 1M tokens (USD)", item.output_cost_per_million); if (output === null) return; patch("model", item.id, { input_cost_per_million: Number(input), output_cost_per_million: Number(output) }); }}>Editar custos</button><button className={item.active ? "ai2-toggle on" : "ai2-toggle"} disabled={busy === `model:${item.id}`} onClick={() => patch("model", item.id, { active: !item.active })}>{item.active ? "Ativo" : "Inativo"}</button></div></td></tr>)}</tbody></table></div></section>}

      {tab === "Rotas" && <section className="ai2-panel"><header><div><span>AI ROUTER</span><h3>Rotas e fallback</h3></div></header><form className="ai2-form" onSubmit={async (e) => { e.preventDefault(); if (await post({ entity: "route", ...routeForm })) setRouteForm({ operationType: "*", level: 1, modelId: "", fallbackModelId: "", minQualityScore: 0 }); }}><label>Operação<input value={routeForm.operationType} onChange={(e) => setRouteForm((v) => ({ ...v, operationType: e.target.value }))} /></label><label>Nível<select value={routeForm.level} onChange={(e) => setRouteForm((v) => ({ ...v, level: Number(e.target.value) }))}>{levels.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.label}</option>)}</select></label><label>Modelo principal<select value={routeForm.modelId} onChange={(e) => setRouteForm((v) => ({ ...v, modelId: e.target.value }))}><option value="">Automático</option>{(data?.models || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Fallback<select value={routeForm.fallbackModelId} onChange={(e) => setRouteForm((v) => ({ ...v, fallbackModelId: e.target.value }))}><option value="">Sem fallback fixo</option>{(data?.models || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Qualidade mínima<input type="number" min="0" max="100" value={routeForm.minQualityScore} onChange={(e) => setRouteForm((v) => ({ ...v, minQualityScore: Number(e.target.value) }))} /></label><button className="root2-button primary" disabled={busy === "create"}>+ Criar rota</button></form><div className="ai2-table-wrap"><table><thead><tr><th>Operação</th><th>Nível</th><th>Principal</th><th>Fallback</th><th>Qualidade mín.</th><th>Status</th></tr></thead><tbody>{(data?.routes || []).map((item) => <tr key={item.id}><td><strong>{item.operation_type}</strong></td><td>{levelName(item.level)}</td><td>{item.model?.name || modelMap[item.model_id]?.name || "Automático"}</td><td>{item.fallback?.name || modelMap[item.fallback_model_id]?.name || "—"}</td><td>{item.min_quality_score}</td><td><button className={item.active ? "ai2-toggle on" : "ai2-toggle"} onClick={() => patch("route", item.id, { active: !item.active })}>{item.active ? "Ativa" : "Inativa"}</button></td></tr>)}</tbody></table></div></section>}

      {tab === "Consumo" && <section className="ai2-panel"><header><div><span>CENTRO DE CUSTO</span><h3>Operações recentes</h3></div></header><div className="ai2-table-wrap"><table><thead><tr><th>Data</th><th>Operação</th><th>Nível</th><th>Modelo</th><th>Tokens</th><th>Custo</th><th>Status</th></tr></thead><tbody>{(data?.operations || []).map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString("pt-BR")}</td><td>{item.operation_type}</td><td>{levelName(item.requested_level)}</td><td>{modelMap[item.model_id]?.name || "—"}</td><td>{Number(item.input_tokens || 0) + Number(item.output_tokens || 0)}</td><td>{usd(item.cost_usd, 6)}</td><td><span className={`ai2-status ${item.status === "SUCCESS" ? "on" : "off"}`}>{item.status}</span></td></tr>)}{!(data?.operations || []).length && <tr><td colSpan="7" className="ai2-empty">Nenhuma operação real registrada ainda.</td></tr>}</tbody></table></div></section>}

      {tab === "Limites" && <section className="ai2-panel"><header><div><span>PROTEÇÃO DE MARGEM</span><h3>Franquias por cliente</h3></div></header><form className="ai2-form ai2-limit-form" onSubmit={async (e) => { e.preventDefault(); await post({ entity: "limit", ...limitForm }); }}><label>Cliente<select required value={limitForm.organizationId} onChange={(e) => setLimitForm((v) => ({ ...v, organizationId: e.target.value }))}><option value="">Selecione</option>{(data?.organizations || []).map((o) => <option key={o.id} value={o.id}>{o.name || o.legal_name || o.id}</option>)}</select></label><label>Operação<input value={limitForm.operationType} onChange={(e) => setLimitForm((v) => ({ ...v, operationType: e.target.value }))} /></label><label>Operações/mês<input type="number" min="0" value={limitForm.monthlyOperations} onChange={(e) => setLimitForm((v) => ({ ...v, monthlyOperations: e.target.value }))} /></label><label>Teto de custo USD<input type="number" min="0" step="0.01" value={limitForm.monthlyCostUsd} onChange={(e) => setLimitForm((v) => ({ ...v, monthlyCostUsd: e.target.value }))} /></label><label className="ai2-check"><input type="checkbox" checked={limitForm.hardLimit} onChange={(e) => setLimitForm((v) => ({ ...v, hardLimit: e.target.checked }))} /> Bloqueio rígido</label><button className="root2-button primary" disabled={busy === "create"}>Salvar limite</button></form><div className="ai2-table-wrap"><table><thead><tr><th>Cliente</th><th>Operação</th><th>Operações/mês</th><th>Custo/mês</th><th>Regra</th><th>Status</th></tr></thead><tbody>{(data?.limits || []).map((item) => <tr key={item.id}><td>{organizationMap[item.organization_id]?.name || organizationMap[item.organization_id]?.legal_name || item.organization_id}</td><td>{item.operation_type}</td><td>{item.monthly_operations ?? "Ilimitado"}</td><td>{item.monthly_cost_usd == null ? "—" : usd(item.monthly_cost_usd, 2)}</td><td>{item.hard_limit ? "Bloquear" : "Alertar"}</td><td><span className={`ai2-status ${item.active ? "on" : "off"}`}>{item.active ? "Ativo" : "Inativo"}</span></td></tr>)}{!(data?.limits || []).length && <tr><td colSpan="6" className="ai2-empty">Nenhum limite personalizado cadastrado.</td></tr>}</tbody></table></div></section>}
    </div>
  );
}
