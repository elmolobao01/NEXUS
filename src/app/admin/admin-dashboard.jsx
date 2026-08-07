"use client";

import Image from "next/image";
import { useState } from "react";
import ClientsSection from "./clients-section";
import AlertsCard from "./components/cards/alerts-card";
import MetricCard from "./components/cards/metric-card";
import ModulesCard from "./components/cards/modules-card";
import RecentClients from "./components/cards/recent-clients";
import RevenueChart from "./components/cards/revenue-chart";
import SegmentsCard from "./components/cards/segments-card";
import {
  alertasRoot,
  metricasRoot,
  modulosMaisVendidos,
  navegacaoRoot,
  receitaMensal,
  segmentos,
  ultimosClientes,
} from "./dashboard-data";

export default function AdminDashboard() {
  const [secao, setSecao] = useState("Visão executiva");
  const [menuAberto, setMenuAberto] = useState(false);
  const [novoClienteRequest, setNovoClienteRequest] = useState(0);

  return (
    <main className="root2-layout">
      <aside className={`root2-sidebar ${menuAberto ? "is-open" : ""}`}>
        <div className="root2-brand">
          <Image
            src="/branding/nexus-logo.png"
            width={54}
            height={54}
            alt="NEXUS"
            priority
          />
          <div>
            <strong>NEXUS</strong>
            <span>Centro de Controle ROOT</span>
          </div>
        </div>

        <div className="root2-root-badge">
          <span>ROOT</span>
          <div>
            <strong>Fundador</strong>
            <small>Acesso total ao ecossistema</small>
          </div>
        </div>

        <nav>
          {navegacaoRoot.map((item) => (
            <button
              type="button"
              key={item}
              className={item === secao ? "is-active" : ""}
              onClick={() => {
                setSecao(item);
                setMenuAberto(false);
              }}
            >
              <span aria-hidden="true">•</span>
              {item}
            </button>
          ))}
        </nav>

        <footer>
          <span className="root2-online-dot" />
          <div>
            <strong>Serviços disponíveis</strong>
            <small>Disponibilidade atual: 99,98%</small>
          </div>
        </footer>
      </aside>

      <section className="root2-main">
        <header className="root2-topbar">
          <div className="root2-topbar-title">
            <button
              type="button"
              className="root2-menu-button"
              onClick={() => setMenuAberto((valor) => !valor)}
            >
              ☰
            </button>
            <div>
              <p>ECOSSISTEMA INTELIGENTE DE GESTÃO OPERACIONAL</p>
              <h1>{secao}</h1>
            </div>
          </div>

          <div className="root2-user-area">
            <button type="button" className="root2-alert-button">
              <span>4</span>
              Alertas
            </button>
            <button type="button" className="root2-user-button">
              <span>EL</span>
              <div>
                <strong>Elmo Lobão</strong>
                <small>NEXUS ROOT</small>
              </div>
            </button>
          </div>
        </header>

        <div className="root2-content">
          {secao === "Visão executiva" ? (
            <>
              <section className="root2-hero">
                <div>
                  <span>CENTRO DE INTELIGÊNCIA ROOT</span>
                  <h2>Decisões executivas em uma única visão.</h2>
                  <p>
                    Acompanhe desempenho comercial, receita, segmentos,
                    módulos, contratos e alertas operacionais do ecossistema.
                  </p>
                </div>

                <div>
                  <button type="button" className="root2-button secondary">
                    Exportar relatório
                  </button>
                  <button
                    type="button"
                    className="root2-button primary"
                    onClick={() => {
                      setSecao("Clientes");
                      setNovoClienteRequest((value) => value + 1);
                    }}
                  >
                    + Novo cliente
                  </button>
                </div>
              </section>

              <section className="root2-metrics-grid">
                {metricasRoot.map((metrica) => (
                  <MetricCard key={metrica.id} metrica={metrica} />
                ))}
              </section>

              <section className="root2-grid-large">
                <RevenueChart dados={receitaMensal} />
                <SegmentsCard segmentos={segmentos} />
              </section>

              <section className="root2-grid-small">
                <ModulesCard modulos={modulosMaisVendidos} />
                <AlertsCard alertas={alertasRoot} />
              </section>

              <RecentClients clientes={ultimosClientes} />
            </>
          ) : secao === "Clientes" ? (
            <ClientsSection openRequest={novoClienteRequest} />
          ) : (
            <section className="root2-placeholder">
              <span>NEXUS FOUNDATION 1.7</span>
              <h2>{secao}</h2>
              <p>
                A navegação está preparada. Esta área será conectada ao núcleo
                persistente nas próximas sprints.
              </p>
              <button type="button" className="root2-button primary">
                Iniciar configuração
              </button>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
