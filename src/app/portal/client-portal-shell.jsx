"use client";

import { useMemo, useState } from "react";

const ambientes = {
  educacao: {
    nome: "NEXUS Educação",
    organizacao: "Colégio Horizonte",
    unidade: "Unidade Centro",
    destaque: "#0066ff",
    fundo: "#f4f7fb",
    menu: ["Visão geral", "Alunos", "Professores", "Turmas", "Frequência", "Relatórios"],
    indicadores: [
      ["Alunos ativos", "1.248"],
      ["Turmas", "42"],
      ["Frequência", "94,8%"],
      ["Pendências", "17"],
    ],
  },
  hotelaria: {
    nome: "NEXUS Hotelaria",
    organizacao: "Hotel Serra Azul",
    unidade: "Unidade Centro",
    destaque: "#c65a11",
    fundo: "#f7f4f2",
    menu: ["Visão geral", "Reservas", "Hóspedes", "Acomodações", "Governança", "Financeiro"],
    indicadores: [
      ["Ocupação", "78%"],
      ["Reservas", "126"],
      ["Check-ins hoje", "18"],
      ["Quartos em limpeza", "9"],
    ],
  },
};

export default function ClientPortalShell() {
  const [portfolio, setPortfolio] = useState("educacao");
  const ambiente = useMemo(() => ambientes[portfolio], [portfolio]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        background: ambiente.fundo,
        color: "#111827",
      }}
    >
      <aside style={{ background: "#ffffff", padding: 24, borderRight: "1px solid #e5e7eb" }}>
        <div style={{ fontWeight: 900, fontSize: 24, marginBottom: 8 }}>NEXUS</div>
        <div style={{ color: ambiente.destaque, fontWeight: 800, marginBottom: 24 }}>{ambiente.nome}</div>

        <select
          value={portfolio}
          onChange={(event) => setPortfolio(event.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db", marginBottom: 24 }}
        >
          <option value="educacao">Educação</option>
          <option value="hotelaria">Hotelaria</option>
        </select>

        <nav style={{ display: "grid", gap: 8 }}>
          {ambiente.menu.map((item, index) => (
            <button
              key={item}
              type="button"
              style={{
                textAlign: "left",
                border: 0,
                borderRadius: 10,
                padding: "11px 12px",
                fontWeight: 700,
                background: index === 0 ? ambiente.destaque : "transparent",
                color: index === 0 ? "#ffffff" : "#374151",
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <section style={{ padding: 32 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <p style={{ margin: 0, color: "#6b7280" }}>{ambiente.organizacao}</p>
            <h1 style={{ margin: "4px 0 0" }}>Visão geral</h1>
          </div>
          <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: 12, boxShadow: "0 8px 24px rgba(15,23,42,.08)" }}>
            {ambiente.unidade} · Perfil Gestor
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
          {ambiente.indicadores.map(([rotulo, valor]) => (
            <article key={rotulo} style={{ background: "#ffffff", borderRadius: 18, padding: 20, boxShadow: "0 10px 30px rgba(15,23,42,.07)" }}>
              <span style={{ color: "#6b7280", fontWeight: 700 }}>{rotulo}</span>
              <strong style={{ display: "block", fontSize: 30, marginTop: 10, color: ambiente.destaque }}>{valor}</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
