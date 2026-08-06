"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

const metricas = [
  { label: "Clientes ativos", value: "18", delta: "+3 neste mês", icon: "◫" },
  { label: "Receita recorrente", value: "R$ 28,4 mil", delta: "+12,8%", icon: "↗" },
  { label: "Licenças ativas", value: "246", delta: "98,4% regulares", icon: "◇" },
  { label: "Ambientes online", value: "31", delta: "99,98% disponibilidade", icon: "●" },
];

const operacao = [
  { label: "Contratos a vencer", value: 4, status: "atencao" },
  { label: "Implantações em curso", value: 3, status: "informacao" },
  { label: "Chamados em aberto", value: 7, status: "atencao" },
  { label: "Backups verificados", value: "100%", status: "sucesso" },
];

const clientes = [
  {
    nome: "Colégio Horizonte",
    portfolio: "Educação",
    plano: "Profissional",
    mensalidade: "R$ 1.290",
    status: "Ativo",
  },
  {
    nome: "Hotel Serra Azul",
    portfolio: "Hotelaria",
    plano: "Enterprise",
    mensalidade: "R$ 2.480",
    status: "Ativo",
  },
  {
    nome: "Clínica Vida",
    portfolio: "Saúde",
    plano: "Profissional",
    mensalidade: "R$ 1.890",
    status: "Implantação",
  },
  {
    nome: "Prefeitura Municipal",
    portfolio: "Governamental",
    plano: "Enterprise",
    mensalidade: "R$ 4.900",
    status: "Ativo",
  },
];

const menu = [
  "Visão executiva",
  "Clientes",
  "Contratos",
  "Planos e módulos",
  "Hospedagem",
  "Financeiro",
  "Implantações",
  "Suporte",
  "Auditoria",
  "Configurações",
];

export default function ControlCenter() {
  const [secao, setSecao] = useState("Visão executiva");
  const [busca, setBusca] = useState("");

  const clientesFiltrados = useMemo(
    () =>
      clientes.filter((cliente) =>
        `${cliente.nome} ${cliente.portfolio} ${cliente.plano}`
          .toLowerCase()
          .includes(busca.toLowerCase())
      ),
    [busca]
  );

  return (
    <main className="nexus-control-center">
      <aside className="nexus-control-sidebar">
        <div className="nexus-control-brand">
          <Image
            src="/branding/nexus-logo.png"
            width={52}
            height={52}
            alt="NEXUS"
          />
          <div>
            <strong>NEXUS</strong>
            <span>Centro de Controle</span>
          </div>
        </div>

        <nav>
          {menu.map((item) => (
            <button
              key={item}
              type="button"
              className={secao === item ? "is-active" : ""}
              onClick={() => setSecao(item)}
            >
              <span aria-hidden="true">•</span>
              {item}
            </button>
          ))}
        </nav>

        <div className="nexus-control-sidebar-footer">
          <span className="nexus-online-dot" />
          <div>
            <strong>Plataforma operacional</strong>
            <small>Todos os serviços disponíveis</small>
          </div>
        </div>
      </aside>

      <section className="nexus-control-content">
        <header className="nexus-control-header">
          <div>
            <p>ECOSSISTEMA INTELIGENTE DE GESTÃO OPERACIONAL</p>
            <h1>{secao}</h1>
          </div>

          <div className="nexus-control-header-actions">
            <button type="button" className="nexus-icon-button" title="Notificações">
              3
            </button>
            <button type="button" className="nexus-user-button">
              <span>EL</span>
              <div>
                <strong>Elmo Lobão</strong>
                <small>Administrador geral</small>
              </div>
            </button>
          </div>
        </header>

        <section className="nexus-control-hero">
          <div>
            <span className="nexus-control-eyebrow">CENTRO DE INTELIGÊNCIA</span>
            <h2>Controle completo do ecossistema NEXUS.</h2>
            <p>
              Acompanhe clientes, contratos, receita, infraestrutura e operação
              em uma única visão executiva.
            </p>
          </div>
          <div className="nexus-control-hero-actions">
            <button type="button" className="nexus-button-secondary">
              Exportar relatório
            </button>
            <button type="button" className="nexus-button-primary">
              + Novo cliente
            </button>
          </div>
        </section>

        <section className="nexus-control-metrics">
          {metricas.map((metrica) => (
            <article key={metrica.label} className="nexus-control-metric-card">
              <div className="nexus-control-metric-icon">{metrica.icon}</div>
              <p>{metrica.label}</p>
              <strong>{metrica.value}</strong>
              <span>{metrica.delta}</span>
            </article>
          ))}
        </section>

        <section className="nexus-control-grid">
          <article className="nexus-control-panel nexus-revenue-panel">
            <div className="nexus-panel-title">
              <div>
                <span>DESEMPENHO COMERCIAL</span>
                <h3>Receita recorrente</h3>
              </div>
              <select defaultValue="6">
                <option value="6">Últimos 6 meses</option>
                <option value="12">Últimos 12 meses</option>
              </select>
            </div>

            <div className="nexus-fake-chart" aria-label="Evolução da receita recorrente">
              {[38, 48, 46, 62, 75, 88].map((altura, indice) => (
                <div className="nexus-chart-column" key={indice}>
                  <span style={{ height: `${altura}%` }} />
                  <small>{["Mar", "Abr", "Mai", "Jun", "Jul", "Ago"][indice]}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="nexus-control-panel">
            <div className="nexus-panel-title">
              <div>
                <span>OPERAÇÃO</span>
                <h3>Situação atual</h3>
              </div>
            </div>

            <div className="nexus-operation-list">
              {operacao.map((item) => (
                <div key={item.label}>
                  <span className={`nexus-status-dot ${item.status}`} />
                  <p>{item.label}</p>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="nexus-control-panel nexus-client-panel">
          <div className="nexus-panel-title nexus-client-panel-header">
            <div>
              <span>CARTEIRA ATIVA</span>
              <h3>Clientes e contratos</h3>
            </div>
            <input
              type="search"
              placeholder="Pesquisar cliente, portfólio ou plano"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>

          <div className="nexus-client-table-wrap">
            <table className="nexus-client-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Portfólio</th>
                  <th>Plano</th>
                  <th>Mensalidade</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((cliente) => (
                  <tr key={cliente.nome}>
                    <td><strong>{cliente.nome}</strong></td>
                    <td>{cliente.portfolio}</td>
                    <td>{cliente.plano}</td>
                    <td>{cliente.mensalidade}</td>
                    <td>
                      <span
                        className={`nexus-contract-status ${
                          cliente.status === "Ativo" ? "ativo" : "implantacao"
                        }`}
                      >
                        {cliente.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
