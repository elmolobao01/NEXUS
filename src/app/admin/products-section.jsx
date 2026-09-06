"use client";

import { useEffect, useMemo, useState } from "react";
import "./products.css";

const INITIAL = { code: "", name: "", category: "Produto", segment: "Todos", monthlyPrice: "", annualPrice: "", active: true };
const SEGMENTS = ["Todos", "Governamental", "Educação", "Saúde", "Hotelaria", "Restaurantes"];

function money(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export default function ProductsSection() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(INITIAL);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/admin/produtos", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setProducts(data.products || []);
    } catch (error) {
      setMessage(error.message || "Não foi possível carregar o catálogo.");
    }
  }

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => ({
    total: products.length,
    active: products.filter((item) => item.active).length,
    monthly: products.reduce((total, item) => total + Number(item.monthly_price || 0), 0),
  }), [products]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/produtos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setOpen(false);
      setForm(INITIAL);
      await load();
      setMessage("Produto incluído no catálogo comercial.");
    } catch (error) {
      setMessage(error.message || "Falha ao cadastrar produto.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <section className="root2-section-intro root2-clients-intro"><div><span>CATÁLOGO COMERCIAL</span><h2>Planos e módulos</h2><p>Defina os produtos e preços que serão utilizados automaticamente nos contratos.</p></div><button className="root2-button primary" onClick={() => setOpen(true)}>+ Novo produto</button></section>
    <section className="root2-client-summary"><article><span>Produtos</span><strong>{summary.total}</strong><small>Total cadastrado</small></article><article><span>Ativos</span><strong>{summary.active}</strong><small>Disponíveis para contratação</small></article><article><span>Soma mensal</span><strong>{money(summary.monthly)}</strong><small>Referência do catálogo</small></article></section>
    {message && <div className="root2-client-message info">{message}</div>}
    <section className="root2-panel root2-client-management"><header className="root2-panel-header"><div><span>PORTFÓLIO NEXUS</span><h3>Produtos disponíveis</h3></div></header><div className="nexus-products-grid">{!products.length ? <p>Nenhum produto cadastrado.</p> : products.map((product) => <article key={product.id} className="nexus-product-card"><div className="nexus-product-card-top"><span>{product.code}</span><b>{product.active ? "Ativo" : "Inativo"}</b></div><h3>{product.name}</h3><p>{product.category} · {product.segment}</p><div className="nexus-product-card-prices"><div><small>Mensal</small><strong>{money(product.monthly_price)}</strong></div><div><small>Anual</small><strong>{money(product.annual_price || Number(product.monthly_price || 0) * 12)}</strong></div></div></article>)}</div></section>
    {open && <div className="root2-modal-backdrop"><section className="root2-modal nexus-product-modal"><header><div><span>NOVO PRODUTO</span><h3>Preço de tabela</h3></div></header><form onSubmit={save}><div className="nexus-product-form"><label><span>Código *</span><input required value={form.code} onChange={(e) => setForm({...form,code:e.target.value.toUpperCase()})} placeholder="GESTAO" /></label><label><span>Nome *</span><input required value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} placeholder="NEXUS Gestão" /></label><label><span>Categoria</span><input value={form.category} onChange={(e) => setForm({...form,category:e.target.value})} /></label><label><span>Segmento</span><select value={form.segment} onChange={(e) => setForm({...form,segment:e.target.value})}>{SEGMENTS.map((segment) => <option key={segment}>{segment}</option>)}</select></label><label><span>Preço mensal (R$) *</span><input required type="number" min="0" step="0.01" value={form.monthlyPrice} onChange={(e) => setForm({...form,monthlyPrice:e.target.value})} /></label><label><span>Preço anual (R$)</span><input type="number" min="0" step="0.01" value={form.annualPrice} onChange={(e) => setForm({...form,annualPrice:e.target.value})} placeholder="Se vazio: mensal × 12" /></label></div><footer><button type="button" className="root2-button neutral" onClick={() => setOpen(false)}>Cancelar</button><button className="root2-button primary" disabled={saving}>{saving ? "Salvando…" : "Cadastrar produto"}</button></footer></form></section></div>}
  </>;
}
