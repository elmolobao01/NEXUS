"use client";

import { useEffect, useMemo, useState } from "react";
import "./contracts.css";

const STATUS = [
  ["draft", "Rascunho"],
  ["active", "Ativo"],
  ["suspended", "Suspenso"],
  ["ended", "Encerrado"],
  ["cancelled", "Cancelado"],
];

const INITIAL = {
  clientId: "",
  number: "",
  startDate: "",
  billingCycle: "monthly",
  durationMonths: 1,
  status: "draft",
  productIds: [],
  referralName: "",
  referralDiscountPct: 0,
  manualDiscountPct: 0,
  manualDiscountReason: "",
  notes: "",
};

const DISCOUNT_CAP = 15;

function money(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`)
  );
}

function calculateEndDate(startDate, months) {
  if (!startDate || !months) return "";
  const [year, month, day] = startDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + Number(months), day));
  target.setUTCDate(target.getUTCDate() - 1);
  return target.toISOString().slice(0, 10);
}

function comboDiscount(productCount) {
  if (productCount >= 4) return 10;
  if (productCount === 3) return 8;
  if (productCount === 2) return 5;
  return 0;
}

function termDiscount(months) {
  const value = Number(months || 0);
  if (value >= 48) return 10;
  if (value >= 36) return 8;
  if (value >= 24) return 5;
  return 0;
}

export default function ContractsSection() {
  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(INITIAL);

  async function load() {
    setLoading(true);
    try {
      const [contractsResponse, clientsResponse, productsResponse] = await Promise.all([
        fetch("/api/admin/contratos", { cache: "no-store" }),
        fetch("/api/admin/clientes", { cache: "no-store" }),
        fetch("/api/admin/produtos", { cache: "no-store" }),
      ]);
      const [contractsData, clientsData, productsData] = await Promise.all([
        contractsResponse.json(),
        clientsResponse.json(),
        productsResponse.json(),
      ]);
      if (!contractsResponse.ok) throw new Error(contractsData.message);
      if (!clientsResponse.ok) throw new Error(clientsData.message);
      if (!productsResponse.ok) throw new Error(productsData.message);
      setContracts(contractsData.contracts || []);
      setClients(clientsData.clients || []);
      setProducts((productsData.products || []).filter((item) => item.active));
    } catch (error) {
      setMessage(error.message || "Falha ao carregar contratos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selectedProducts = useMemo(
    () => products.filter((product) => form.productIds.includes(product.id)),
    [products, form.productIds]
  );

  const calculated = useMemo(() => {
    const months = Number(form.durationMonths || 0);
    const years = months / 12;
    const gross = selectedProducts.reduce((total, product) => {
      if (form.billingCycle === "annual") {
        const annualPrice = Number(product.annual_price || 0) || Number(product.monthly_price || 0) * 12;
        return total + annualPrice * years;
      }
      return total + Number(product.monthly_price || 0) * months;
    }, 0);
    const combo = comboDiscount(selectedProducts.length);
    const term = termDiscount(months);
    const referral = Math.max(0, Math.min(10, Number(form.referralDiscountPct || 0)));
    const manual = Math.max(0, Math.min(15, Number(form.manualDiscountPct || 0)));
    const requestedDiscount = combo + term + referral + manual;
    const discountPct = Math.min(DISCOUNT_CAP, requestedDiscount);
    const discountValue = gross * (discountPct / 100);
    const net = gross - discountValue;
    return {
      gross,
      combo,
      term,
      referral,
      manual,
      requestedDiscount,
      discountPct,
      discountValue,
      net,
      endDate: calculateEndDate(form.startDate, months),
    };
  }, [form, selectedProducts]);

  const summary = useMemo(
    () => ({
      total: contracts.length,
      active: contracts.filter((item) => item.status === "active").length,
      mrr: contracts
        .filter((item) => item.status === "active")
        .reduce((total, item) => total + Number(item.net_value || item.value || 0) / Math.max(1, Number(item.duration_months || 1)), 0),
      ending: contracts.filter((item) => {
        if (!item.end_date || item.status !== "active") return false;
        const days = (new Date(`${item.end_date}T00:00:00`) - new Date()) / 86400000;
        return days >= 0 && days <= 30;
      }).length,
    }),
    [contracts]
  );

  function toggleProduct(productId) {
    setForm((current) => ({
      ...current,
      productIds: current.productIds.includes(productId)
        ? current.productIds.filter((id) => id !== productId)
        : [...current.productIds, productId],
    }));
  }

  function setCycle(value) {
    setForm((current) => ({
      ...current,
      billingCycle: value,
      durationMonths: value === "annual" ? 12 : 1,
    }));
  }

  async function save(event) {
    event.preventDefault();
    if (!form.productIds.length) {
      setMessage("Selecione pelo menos um produto para o contrato.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setOpen(false);
      setForm(INITIAL);
      await load();
      setMessage("Contrato cadastrado com cálculo automático de produtos, prazo e descontos.");
    } catch (error) {
      setMessage(error.message || "Falha ao cadastrar contrato.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="root2-section-intro root2-clients-intro">
        <div>
          <span>GESTÃO COMERCIAL</span>
          <h2>Contratos</h2>
          <p>Produtos, vigência, recorrência e benefícios comerciais calculados em uma única operação.</p>
        </div>
        <button className="root2-button primary" onClick={() => setOpen(true)}>
          + Novo contrato
        </button>
      </section>

      <section className="root2-client-summary">
        <article><span>Contratos</span><strong>{loading ? "…" : summary.total}</strong><small>Total cadastrado</small></article>
        <article><span>Ativos</span><strong>{loading ? "…" : summary.active}</strong><small>Operação vigente</small></article>
        <article><span>MRR equivalente</span><strong>{loading ? "…" : money(summary.mrr)}</strong><small>Receita mensal contratada</small></article>
        <article><span>Vencem em 30 dias</span><strong>{loading ? "…" : summary.ending}</strong><small>Atenção para renovação</small></article>
      </section>

      {message && <div className="root2-client-message info">{message}</div>}

      <section className="root2-panel root2-client-management">
        <header className="root2-panel-header"><div><span>CARTEIRA CONTRATUAL</span><h3>Contratos cadastrados</h3></div></header>
        <div className="nexus-contract-table-wrap">
          <table className="nexus-contract-table">
            <thead><tr><th>Contrato</th><th>Cliente</th><th>Produtos</th><th>Vigência</th><th>Prazo</th><th>Bruto</th><th>Desconto</th><th>Líquido</th><th>Status</th></tr></thead>
            <tbody>
              {!loading && !contracts.length ? <tr><td colSpan="9">Nenhum contrato cadastrado.</td></tr> : contracts.map((item) => (
                <tr key={item.id}>
                  <td>{item.number}</td>
                  <td>{item.client_name || "—"}</td>
                  <td>{item.product_names?.join(", ") || "—"}</td>
                  <td>{formatDate(item.start_date)} → {formatDate(item.end_date)}</td>
                  <td>{item.duration_months || "—"} meses</td>
                  <td>{money(item.gross_value || item.value)}</td>
                  <td>{Number(item.discount_pct || 0).toFixed(2)}%</td>
                  <td>{money(item.net_value || item.value)}</td>
                  <td>{STATUS.find((status) => status[0] === item.status)?.[1] || item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {open && (
        <div className="root2-modal-backdrop">
          <section className="root2-modal nexus-contract-modal">
            <header><div><span>NOVO CONTRATO</span><h3>Composição contratual</h3></div></header>
            <form onSubmit={save}>
              <div className="nexus-contract-form">
                <label className="span-2"><span>Cliente *</span>
                  <select required value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>
                    <option value="">Selecione</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.trade_name || client.legal_name || client.name}</option>)}
                  </select>
                </label>

                <label><span>Número *</span><input required value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} /></label>
                <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{STATUS.map((status) => <option key={status[0]} value={status[0]}>{status[1]}</option>)}</select></label>

                <div className="span-2 nexus-product-picker">
                  <div className="nexus-field-title">Produtos / módulos *</div>
                  {!products.length ? <p className="nexus-contract-hint">Nenhum produto ativo. Cadastre primeiro em “Planos e módulos”.</p> : products.map((product) => (
                    <label key={product.id} className={`nexus-product-option ${form.productIds.includes(product.id) ? "is-selected" : ""}`}>
                      <input type="checkbox" checked={form.productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} />
                      <div><strong>{product.name}</strong><small>{product.code} · {product.category || "Produto"}</small></div>
                      <div className="nexus-product-price"><strong>{money(product.monthly_price)}/mês</strong><small>{money(product.annual_price || Number(product.monthly_price || 0) * 12)}/ano</small></div>
                    </label>
                  ))}
                </div>

                <label><span>Periodicidade *</span><select value={form.billingCycle} onChange={(event) => setCycle(event.target.value)}><option value="monthly">Mensal</option><option value="annual">Anual</option></select></label>
                {form.billingCycle === "monthly" ? (
                  <label><span>Quantidade de meses *</span><input required type="number" min="1" max="120" value={form.durationMonths} onChange={(event) => setForm({ ...form, durationMonths: Number(event.target.value) })} /></label>
                ) : (
                  <label><span>Prazo anual *</span><select value={form.durationMonths} onChange={(event) => setForm({ ...form, durationMonths: Number(event.target.value) })}><option value={12}>12 meses</option><option value={24}>24 meses</option><option value={36}>36 meses</option><option value={48}>48 meses</option><option value={60}>60 meses</option></select></label>
                )}

                <label><span>Data inicial *</span><input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
                <label><span>Data final automática</span><input type="date" value={calculated.endDate} readOnly /></label>

                <label><span>Indicação / indicador</span><input value={form.referralName} onChange={(event) => setForm({ ...form, referralName: event.target.value })} placeholder="Nome ou referência da indicação" /></label>
                <label><span>Desconto por indicação (%)</span><input type="number" min="0" max="10" step="0.01" value={form.referralDiscountPct} onChange={(event) => setForm({ ...form, referralDiscountPct: Number(event.target.value) })} /></label>

                <label><span>Desconto adicional ROOT (%)</span><input type="number" min="0" max="15" step="0.01" value={form.manualDiscountPct} onChange={(event) => setForm({ ...form, manualDiscountPct: Number(event.target.value) })} /></label>
                <label><span>Justificativa do desconto adicional</span><input value={form.manualDiscountReason} onChange={(event) => setForm({ ...form, manualDiscountReason: event.target.value })} /></label>

                <div className="span-2 nexus-contract-calculation">
                  <div><span>Valor bruto</span><strong>{money(calculated.gross)}</strong></div>
                  <div><span>Combo de produtos</span><strong>{calculated.combo.toFixed(2)}%</strong></div>
                  <div><span>Prazo</span><strong>{calculated.term.toFixed(2)}%</strong></div>
                  <div><span>Indicação</span><strong>{calculated.referral.toFixed(2)}%</strong></div>
                  <div><span>Adicional ROOT</span><strong>{calculated.manual.toFixed(2)}%</strong></div>
                  <div className="is-total"><span>Desconto aplicado</span><strong>{calculated.discountPct.toFixed(2)}% · {money(calculated.discountValue)}</strong></div>
                  <div className="is-net"><span>Valor líquido do contrato</span><strong>{money(calculated.net)}</strong></div>
                </div>
                {calculated.requestedDiscount > DISCOUNT_CAP && <p className="span-2 nexus-contract-warning">Os benefícios somam {calculated.requestedDiscount.toFixed(2)}%, mas o teto comercial automático é de {DISCOUNT_CAP}%.</p>}

                <label className="span-2"><span>Observações</span><textarea rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
              </div>
              <footer><button type="button" className="root2-button neutral" onClick={() => setOpen(false)}>Cancelar</button><button className="root2-button primary" disabled={saving}>{saving ? "Salvando…" : "Cadastrar contrato"}</button></footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
