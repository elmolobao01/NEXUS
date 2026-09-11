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



function BenchmarkPanel({ onError }) {
  const [bench, setBench] = useState({ cases: [], runs: [], models: [], ranking: [] });
  const [loadingBench, setLoadingBench] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [level, setLevel] = useState(1);
  const [executing, setExecuting] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [scores, setScores] = useState({ accuracy: 0, adherence: 0, quality: 0, structureScore: 0, stability: 0, notes: "" });

  async function loadBenchmark() {
    setLoadingBench(true);
    try {
      const response = await fetch("/api/admin/ai/benchmark", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Falha ao carregar benchmark.");
      setBench(payload);
      if (!selectedId && payload.cases?.[0]) {
        setSelectedId(payload.cases[0].id);
        setPrompt(payload.cases[0].prompt);
        setLevel(Number(payload.cases[0].level || 1));
      }
    } catch (err) { onError(err.message); }
    finally { setLoadingBench(false); }
  }

  useEffect(() => { loadBenchmark(); }, []);

  const selectedCase = bench.cases.find((item) => item.id === selectedId) || null;
  const eligibleModels = bench.models.filter((item) => Number(item.level) === Number(level) && item.active && item.provider?.active);

  function selectCase(id) {
    const item = bench.cases.find((x) => x.id === id);
    setSelectedId(id);
    setResult(null);
    setComparison([]);
    setScores({ accuracy: 0, adherence: 0, quality: 0, structureScore: 0, stability: 0, notes: "" });
    if (item) { setPrompt(item.prompt); setLevel(Number(item.level || 1)); }
  }

  async function runModel(targetModelCode = null) {
    if (!selectedCase || !prompt.trim()) return null;
    const expectsJson = /json/i.test(selectedCase.expected_format || "");
    const response = await fetch("/api/ai/execute", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operationType: selectedCase.operation_type,
        level,
        input: prompt,
        metadata: {
          benchmark: true,
          benchmarkCaseId: selectedCase.id,
          benchmarkCode: selectedCase.code,
          targetModelCode: targetModelCode || undefined,
          responseFormat: expectsJson ? "json" : "text",
        }
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const err = new Error(payload.error || "Falha ao executar o AI Router.");
      err.diagnostics = payload;
      throw err;
    }
    const record = await fetch("/api/admin/ai/benchmark", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: selectedCase.id, operationId: payload.operationId, prompt, output: payload.output, provider: payload.provider, model: payload.model, level }),
    });
    const saved = await record.json();
    if (!record.ok) throw new Error(saved.message || "A resposta foi gerada, mas o benchmark não foi registrado.");
    return { ...payload, runId: saved.run?.id, auto: saved.auto };
  }

  async function executeBenchmark() {
    if (!selectedCase || !prompt.trim()) return;
    setExecuting(true); setResult(null); setComparison([]); onError("");
    try {
      const payload = await runModel();
      setResult(payload);
      if (payload?.auto) {
        setScores((v) => ({ ...v,
          accuracy: Math.round(payload.auto.accuracy || 0),
          adherence: Math.round(payload.auto.adherence || 0),
          structureScore: Math.round(payload.auto.structure || 0),
        }));
      }
      await loadBenchmark();
    } catch (err) { onError(err.message); }
    finally { setExecuting(false); }
  }

  async function compareModels() {
    if (!selectedCase || !prompt.trim() || !eligibleModels.length) return;
    setComparing(true); setResult(null); setComparison([]); onError("");
    const rows = [];
    try {
      for (const model of eligibleModels) {
        try {
          const payload = await runModel(model.code);
          rows.push({ ...payload, requestedModel: model.code, ok: true });
        } catch (err) {
          const d = err?.diagnostics || {};
          rows.push({
            requestedModel: model.code,
            model: d.model || model.code,
            provider: d.provider || model.provider?.code || "—",
            operationId: d.operationId || null,
            latencyMs: d.latencyMs || null,
            ok: false,
            error: err.message,
          });
        }
      }
      setComparison(rows);
      await loadBenchmark();
    } catch (err) { onError(err.message); }
    finally { setComparing(false); }
  }

  async function saveEvaluation() {
    if (!result?.runId || !result?.operationId) return;
    try {
      const response = await fetch("/api/admin/ai/benchmark", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: result.runId, operationId: result.operationId, ...scores }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Falha ao salvar avaliação.");
      setResult((r) => ({ ...r, score: payload.score }));
      await loadBenchmark();
    } catch (err) { onError(err.message); }
  }

  function renderOutput(output) {
    return typeof output === "string" ? output : JSON.stringify(output, null, 2);
  }

  if (loadingBench) return <section className="ai2-panel"><div className="ai2-empty">Carregando Benchmark PLENIUM AI…</div></section>;

  return <section className="ai2-benchmark-grid">
    <article className="ai2-panel ai2-benchmark-runner">
      <header><div><span>BENCHMARK OPERACIONAL · v2</span><h3>Qualidade × custo × latência</h3></div></header>
      <div className="ai2-benchmark-controls">
        <label>Caso de teste<select value={selectedId} onChange={(e) => selectCase(e.target.value)}>{bench.cases.map((item) => <option key={item.id} value={item.id}>{item.category} · {item.title}</option>)}</select></label>
        <label>Nível<select value={level} onChange={(e) => { setLevel(Number(e.target.value)); setComparison([]); }}>{levels.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.label}</option>)}</select></label>
      </div>
      {selectedCase && <div className="ai2-benchmark-info"><strong>{selectedCase.description}</strong><small>Esperado: {selectedCase.expected_format || "—"}</small><small>Critério: {selectedCase.evaluation_notes || "—"}</small><small>Modelos ativos neste nível: {eligibleModels.length}</small></div>}
      <label className="ai2-benchmark-prompt">Prompt<textarea rows="10" value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
      <div className="ai2-benchmark-actions">
        <button className="root2-button primary" disabled={executing || comparing || !selectedCase} onClick={executeBenchmark}>{executing ? "Executando…" : "▶ Executar pelo Router"}</button>
        <button className="root2-button" disabled={executing || comparing || !eligibleModels.length} onClick={compareModels}>{comparing ? "Comparando…" : `Comparar modelos (${eligibleModels.length})`}</button>
      </div>

      {result && <div className="ai2-benchmark-result">
        <div className="ai2-benchmark-result-meta">
          <span><b>Provider</b>{result.provider}</span><span><b>Modelo</b>{result.model}</span><span><b>Latência</b>{Number(result.latencyMs || 0).toLocaleString("pt-BR")} ms</span><span><b>Tokens</b>{Number(result.usage?.inputTokens || 0) + Number(result.usage?.outputTokens || 0)}</span><span><b>Custo</b>{usd(result.usage?.costUsd, 8)}</span><span><b>Fallback</b>{result.fallbackUsed ? "Sim" : "Não"}</span>
        </div>
        {result.auto && <div className={`ai2-auto-score ${result.auto.passed ? "pass" : "fail"}`}><strong>Avaliação automática: {Number(result.auto.score || 0).toFixed(1)}</strong><span>{result.auto.passed ? "APROVADO" : "REVISAR"}</span><small>{(result.auto.details || []).join(" · ")}</small></div>}
        <div className="ai2-benchmark-output"><span>RESPOSTA NORMALIZADA</span><pre>{renderOutput(result.output)}</pre></div>
        <div className="ai2-score-grid">
          {[["accuracy","Precisão"],["adherence","Aderência"],["quality","Qualidade"],["structureScore","Estrutura"],["stability","Estabilidade"]].map(([key,label]) => <label key={key}>{label}<input type="number" min="0" max="100" value={scores[key]} onChange={(e) => setScores((v) => ({ ...v, [key]: Number(e.target.value) }))} /></label>)}
        </div>
        <label className="ai2-benchmark-prompt">Observações<textarea rows="3" value={scores.notes} onChange={(e) => setScores((v) => ({ ...v, notes: e.target.value }))} /></label>
        <div className="ai2-benchmark-actions"><button onClick={saveEvaluation}>Salvar avaliação humana</button>{result.score && <strong>Nota qualitativa: {Number(result.score.final_score || 0).toFixed(1)}</strong>}</div>
      </div>}

      {!!comparison.length && <div className="ai2-comparison-block">
        <h4>Comparação deste caso</h4>
        <div className="ai2-table-wrap"><table><thead><tr><th>Modelo</th><th>Status</th><th>Nota auto</th><th>Latência</th><th>Custo</th><th>Tokens / diagnóstico</th></tr></thead><tbody>
          {comparison.map((row, index) => <tr key={`${row.requestedModel}-${index}`} className={row.ok ? "" : "ai2-row-error"}><td><strong>{row.model || row.requestedModel}</strong><small>{row.provider || "—"}</small>{row.operationId ? <small>op: {row.operationId}</small> : null}</td><td><span className={`ai2-status ${row.ok ? "on" : "off"}`}>{row.ok ? (row.auto?.passed ? "Aprovado" : "Revisar") : "Erro"}</span></td><td>{row.ok ? Number(row.auto?.score || 0).toFixed(1) : "—"}</td><td>{row.latencyMs ? `${Number(row.latencyMs).toLocaleString("pt-BR")} ms` : "—"}</td><td>{row.ok ? usd(row.usage?.costUsd, 8) : "—"}</td><td>{row.ok ? Number(row.usage?.inputTokens || 0)+Number(row.usage?.outputTokens || 0) : <code className="ai2-error-code">{row.error}</code>}</td></tr>)}
        </tbody></table></div>
        {comparison.some((row) => !row.ok) ? <div className="ai2-benchmark-alert"><strong>Diagnóstico de execução</strong><span>O modelo com erro não entra no ranking até concluir uma execução válida. A rota produtiva permanece inalterada.</span></div> : null}
      </div>}
    </article>

    <article className="ai2-panel">
      <header><div><span>RANKING</span><h3>Eficiência por modelo</h3></div></header>
      <div className="ai2-ranking-note">Ranking: qualidade efetiva 70% + custo 20% + latência 10%. A nota automática é usada por padrão; quando existir avaliação humana, ela passa a ser a qualidade efetiva daquela execução.</div>
      <div className="ai2-table-wrap"><table><thead><tr><th>#</th><th>Modelo</th><th>Ranking</th><th>Auto</th><th>Humana</th><th>Efetiva</th><th>Aprovação auto</th><th>Custo médio</th><th>Latência média</th></tr></thead><tbody>
        {bench.ranking.map((row, index) => <tr key={row.model}><td>{index + 1}</td><td><strong>{row.model}</strong><small>{row.provider}</small></td><td><strong>{Number(row.rankingScore || 0).toFixed(1)}</strong></td><td>{Number(row.avgAutoQuality || 0).toFixed(1)}</td><td>{row.avgHumanQuality == null ? "—" : Number(row.avgHumanQuality).toFixed(1)}</td><td><strong>{Number(row.avgQuality || 0).toFixed(1)}</strong></td><td>{pct(row.passRate)}</td><td>{usd(row.avgCost, 8)}</td><td>{Math.round(row.avgLatency || 0).toLocaleString("pt-BR")} ms</td></tr>)}
        {!bench.ranking.length && <tr><td colSpan="9" className="ai2-empty">Execute benchmarks para formar o ranking.</td></tr>}
      </tbody></table></div>

      <header className="ai2-history-header"><div><span>HISTÓRICO</span><h3>Últimos testes</h3></div></header>
      <div className="ai2-table-wrap"><table><thead><tr><th>Data</th><th>Teste</th><th>Modelo</th><th>Auto</th><th>Latência</th><th>Custo</th><th>Humana</th></tr></thead><tbody>
        {bench.runs.map((run) => <tr key={run.id}><td>{new Date(run.created_at).toLocaleString("pt-BR")}</td><td><strong>{run.case?.title || "Teste livre"}</strong><small>{run.case?.category || "—"}</small></td><td>{run.model_code || "—"}</td><td>{run.auto_score == null ? "—" : Number(run.auto_score).toFixed(1)}</td><td>{run.latency_ms == null ? "—" : `${Number(run.latency_ms).toLocaleString("pt-BR")} ms`}</td><td>{usd(run.cost_usd, 8)}</td><td>{run.score?.final_score == null ? "Pendente" : Number(run.score.final_score).toFixed(1)}</td></tr>)}
        {!bench.runs.length && <tr><td colSpan="7" className="ai2-empty">Nenhum benchmark executado ainda.</td></tr>}
      </tbody></table></div>
    </article>
  </section>;
}

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
          <span>PLENIUM AI ENGINE · v0.7</span>
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
        {["Visão geral", "Benchmark", "Providers", "Modelos", "Rotas", "Consumo", "Limites"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}
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

      {tab === "Benchmark" && <BenchmarkPanel onError={setError} />}

      {tab === "Providers" && <section className="ai2-panel"><header><div><span>FORNECEDORES</span><h3>Providers conectáveis</h3><p>Ativação do catálogo, credencial e prontidão são estados independentes. Um provider sem credencial não participa do Benchmark nem do Router produtivo.</p></div></header><div className="ai2-table-wrap"><table><thead><tr><th>Provider</th><th>Código</th><th>Prioridade</th><th>Credencial</th><th>Benchmark</th><th>Produção</th><th>Catálogo</th><th>Ação</th></tr></thead><tbody>{(data?.providers || []).map((item) => { const r=item.readiness||{}; return <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.code}</td><td>{item.priority}</td><td><span className={`ai2-status ${r.configured ? "on" : "off"}`}>{r.configured ? "Configurado" : "Sem credencial"}</span>{!r.configured && r.credentialEnv ? <small>{r.credentialEnv}</small> : null}</td><td><span className={`ai2-status ${r.benchmarkEnabled ? "on" : "off"}`}>{r.benchmarkEnabled ? "Habilitado" : "Bloqueado"}</span></td><td><span className={`ai2-status ${r.productionEnabled ? "on" : "off"}`}>{r.productionEnabled ? "Habilitada" : "Bloqueada"}</span></td><td><span className={`ai2-status ${item.active ? "on" : "off"}`}>{item.active ? "Ativo" : "Inativo"}</span></td><td><button disabled={busy === `provider:${item.id}` || (!item.active && !r.configured)} title={!item.active && !r.configured ? `Configure ${r.credentialEnv || "a credencial"} antes de ativar` : ""} onClick={() => patch("provider", item.id, { active: !item.active })}>{item.active ? "Desativar" : "Ativar"}</button></td></tr>})}</tbody></table></div></section>}

      {tab === "Modelos" && <section className="ai2-panel"><header><div><span>CATÁLOGO</span><h3>Modelos e custo de inferência</h3></div></header><div className="ai2-table-wrap"><table><thead><tr><th>Modelo</th><th>Provider</th><th>Nível</th><th>Input / 1M</th><th>Output / 1M</th><th>Status</th></tr></thead><tbody>{(data?.models || []).map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.code}</small></td><td>{item.provider?.name || providerMap[item.provider_id]?.name || "—"}</td><td><span className="ai2-level-pill">{levelName(item.level)}</span></td><td>{usd(item.input_cost_per_million, 3)}</td><td>{usd(item.output_cost_per_million, 3)}</td><td><div className="ai2-actions"><button onClick={() => { const input = window.prompt("Custo de entrada por 1M tokens (USD)", item.input_cost_per_million); if (input === null) return; const output = window.prompt("Custo de saída por 1M tokens (USD)", item.output_cost_per_million); if (output === null) return; patch("model", item.id, { input_cost_per_million: Number(input), output_cost_per_million: Number(output) }); }}>Editar custos</button><button className={item.active ? "ai2-toggle on" : "ai2-toggle"} disabled={busy === `model:${item.id}`} onClick={() => patch("model", item.id, { active: !item.active })}>{item.active ? "Ativo" : "Inativo"}</button></div></td></tr>)}</tbody></table></div></section>}

      {tab === "Rotas" && <section className="ai2-panel"><header><div><span>AI ROUTER</span><h3>Rotas e fallback</h3></div></header><form className="ai2-form" onSubmit={async (e) => { e.preventDefault(); if (await post({ entity: "route", ...routeForm })) setRouteForm({ operationType: "*", level: 1, modelId: "", fallbackModelId: "", minQualityScore: 0 }); }}><label>Operação<input value={routeForm.operationType} onChange={(e) => setRouteForm((v) => ({ ...v, operationType: e.target.value }))} /></label><label>Nível<select value={routeForm.level} onChange={(e) => setRouteForm((v) => ({ ...v, level: Number(e.target.value) }))}>{levels.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.label}</option>)}</select></label><label>Modelo principal<select value={routeForm.modelId} onChange={(e) => setRouteForm((v) => ({ ...v, modelId: e.target.value }))}><option value="">Automático</option>{(data?.models || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Fallback<select value={routeForm.fallbackModelId} onChange={(e) => setRouteForm((v) => ({ ...v, fallbackModelId: e.target.value }))}><option value="">Sem fallback fixo</option>{(data?.models || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Qualidade mínima<input type="number" min="0" max="100" value={routeForm.minQualityScore} onChange={(e) => setRouteForm((v) => ({ ...v, minQualityScore: Number(e.target.value) }))} /></label><button className="root2-button primary" disabled={busy === "create"}>+ Criar rota</button></form><div className="ai2-table-wrap"><table><thead><tr><th>Operação</th><th>Nível</th><th>Principal</th><th>Fallback</th><th>Qualidade mín.</th><th>Status</th></tr></thead><tbody>{(data?.routes || []).map((item) => <tr key={item.id}><td><strong>{item.operation_type}</strong></td><td>{levelName(item.level)}</td><td>{item.model?.name || modelMap[item.model_id]?.name || "Automático"}</td><td>{item.fallback?.name || modelMap[item.fallback_model_id]?.name || "—"}</td><td>{item.min_quality_score}</td><td><button className={item.active ? "ai2-toggle on" : "ai2-toggle"} onClick={() => patch("route", item.id, { active: !item.active })}>{item.active ? "Ativa" : "Inativa"}</button></td></tr>)}</tbody></table></div></section>}

      {tab === "Consumo" && <section className="ai2-panel"><header><div><span>CENTRO DE CUSTO</span><h3>Operações recentes</h3></div></header><div className="ai2-table-wrap"><table><thead><tr><th>Data</th><th>Operação</th><th>Nível</th><th>Modelo</th><th>Tokens</th><th>Custo</th><th>Status</th></tr></thead><tbody>{(data?.operations || []).map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString("pt-BR")}</td><td>{item.operation_type}</td><td>{levelName(item.requested_level)}</td><td>{modelMap[item.model_id]?.name || "—"}</td><td>{Number(item.input_tokens || 0) + Number(item.output_tokens || 0)}</td><td>{usd(item.cost_usd, 6)}</td><td><span className={`ai2-status ${item.status === "SUCCESS" ? "on" : "off"}`}>{item.status}</span></td></tr>)}{!(data?.operations || []).length && <tr><td colSpan="7" className="ai2-empty">Nenhuma operação real registrada ainda.</td></tr>}</tbody></table></div></section>}

      {tab === "Limites" && <section className="ai2-panel"><header><div><span>PROTEÇÃO DE MARGEM</span><h3>Franquias por cliente</h3></div></header><form className="ai2-form ai2-limit-form" onSubmit={async (e) => { e.preventDefault(); await post({ entity: "limit", ...limitForm }); }}><label>Cliente<select required value={limitForm.organizationId} onChange={(e) => setLimitForm((v) => ({ ...v, organizationId: e.target.value }))}><option value="">Selecione</option>{(data?.organizations || []).map((o) => <option key={o.id} value={o.id}>{o.name || o.legal_name || o.id}</option>)}</select></label><label>Operação<input value={limitForm.operationType} onChange={(e) => setLimitForm((v) => ({ ...v, operationType: e.target.value }))} /></label><label>Operações/mês<input type="number" min="0" value={limitForm.monthlyOperations} onChange={(e) => setLimitForm((v) => ({ ...v, monthlyOperations: e.target.value }))} /></label><label>Teto de custo USD<input type="number" min="0" step="0.01" value={limitForm.monthlyCostUsd} onChange={(e) => setLimitForm((v) => ({ ...v, monthlyCostUsd: e.target.value }))} /></label><label className="ai2-check"><input type="checkbox" checked={limitForm.hardLimit} onChange={(e) => setLimitForm((v) => ({ ...v, hardLimit: e.target.checked }))} /> Bloqueio rígido</label><button className="root2-button primary" disabled={busy === "create"}>Salvar limite</button></form><div className="ai2-table-wrap"><table><thead><tr><th>Cliente</th><th>Operação</th><th>Operações/mês</th><th>Custo/mês</th><th>Regra</th><th>Status</th></tr></thead><tbody>{(data?.limits || []).map((item) => <tr key={item.id}><td>{organizationMap[item.organization_id]?.name || organizationMap[item.organization_id]?.legal_name || item.organization_id}</td><td>{item.operation_type}</td><td>{item.monthly_operations ?? "Ilimitado"}</td><td>{item.monthly_cost_usd == null ? "—" : usd(item.monthly_cost_usd, 2)}</td><td>{item.hard_limit ? "Bloquear" : "Alertar"}</td><td><span className={`ai2-status ${item.active ? "on" : "off"}`}>{item.active ? "Ativo" : "Inativo"}</span></td></tr>)}{!(data?.limits || []).length && <tr><td colSpan="6" className="ai2-empty">Nenhum limite personalizado cadastrado.</td></tr>}</tbody></table></div></section>}
    </div>
  );
}
