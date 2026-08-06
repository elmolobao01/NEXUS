"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  alertasOperacionais,
  clientesDemonstrativos,
  evolucaoReceita,
  indicadoresExecutivos,
  modulosDemonstrativos,
  planosDemonstrativos,
} from "./root-data";

const secoes = [
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

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

function DashboardExecutivo() {
  const maiorReceita = Math.max(...evolucaoReceita.map((item) => item.valor));

  return (
    <>
      <section className="root-hero">
        <div>
          <span>CENTRO DE INTELIGÊNCIA ROOT</span>
          <h2>Controle completo do ecossistema NEXUS.</h2>
          <p>
            Uma visão única para acompanhar clientes, contratos, receita,
            infraestrutura, implantação e operação da plataforma.
          </p>
        </div>

        <div className="root-hero-actions">
          <button type="button" className="root-button root-button-secondary">
            Exportar relatório
          </button>
          <button type="button" className="root-button root-button-primary">
            + Novo cliente
          </button>
        </div>
      </section>

      <section className="root-metrics-grid">
        {indicadoresExecutivos.map((indicador) => (
          <article className="root-metric-card" key={indicador.id}>
            <div className="root-metric-icon">{indicador.icone}</div>
            <p>{indicador.titulo}</p>
            <strong>{indicador.valor}</strong>
            <span className={`root-trend ${indicador.tendencia}`}>
              {indicador.variacao}
            </span>
          </article>
        ))}
      </section>

      <section className="root-dashboard-grid">
        <article className="root-panel root-revenue-panel">
          <header className="root-panel-header">
            <div>
              <span>DESEMPENHO COMERCIAL</span>
              <h3>Receita recorrente mensal</h3>
            </div>
            <select defaultValue="6" aria-label="Período do gráfico">
              <option value="6">Últimos 6 meses</option>
              <option value="12">Últimos 12 meses</option>
            </select>
          </header>

          <div className="root-chart">
            {evolucaoReceita.map((item) => (
              <div className="root-chart-column" key={item.mes}>
                <small>{formatarMoeda(item.valor)}</small>
                <span style={{ height: `${(item.valor / maiorReceita) * 100}%` }} />
                <strong>{item.mes}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="root-panel">
          <header className="root-panel-header">
            <div>
              <span>OPERAÇÃO</span>
              <h3>Alertas prioritários</h3>
            </div>
          </header>

          <div className="root-alert-list">
            {alertasOperacionais.map((alerta) => (
              <article key={alerta.titulo}>
                <span className={`root-alert-dot ${alerta.nivel}`} />
                <div>
                  <strong>{alerta.titulo}</strong>
                  <p>{alerta.descricao}</p>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <ClientesTable titulo="Clientes e contratos recentes" compacta />
    </>
  );
}

function ClientesTable({ titulo = "Gestão de clientes", compacta = false }) {
  const [busca, setBusca] = useState("");
  const [segmento, setSegmento] = useState("Todos");

  const clientesFiltrados = useMemo(() => {
    return clientesDemonstrativos.filter((cliente) => {
      const correspondeBusca = `${cliente.nome} ${cliente.segmento} ${cliente.plano}`
        .toLowerCase()
        .includes(busca.toLowerCase());

      const correspondeSegmento =
        segmento === "Todos" || cliente.segmento === segmento;

      return correspondeBusca && correspondeSegmento;
    });
  }, [busca, segmento]);

  const linhas = compacta ? clientesFiltrados.slice(0, 4) : clientesFiltrados;

  return (
    <section className="root-panel root-client-panel">
      <header className="root-panel-header root-client-header">
        <div>
          <span>CARTEIRA COMERCIAL</span>
          <h3>{titulo}</h3>
        </div>

        <div className="root-client-filters">
          <select
            value={segmento}
            onChange={(event) => setSegmento(event.target.value)}
            aria-label="Filtrar por segmento"
          >
            <option>Todos</option>
            <option>Educação</option>
            <option>Governamental</option>
            <option>Saúde</option>
            <option>Hotelaria</option>
            <option>Restaurantes</option>
          </select>

          <input
            type="search"
            placeholder="Pesquisar cliente, segmento ou plano"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        </div>
      </header>

      <div className="root-table-wrap">
        <table className="root-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Segmento</th>
              <th>Plano</th>
              <th>Módulos</th>
              <th>Unidades</th>
              <th>Mensalidade</th>
              <th>Vencimento</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((cliente) => (
              <tr key={cliente.id}>
                <td><strong>{cliente.nome}</strong></td>
                <td>{cliente.segmento}</td>
                <td>{cliente.plano}</td>
                <td>{cliente.modulos}</td>
                <td>{cliente.unidades}</td>
                <td>{formatarMoeda(cliente.mensalidade)}</td>
                <td>{cliente.vencimento}</td>
                <td>
                  <span
                    className={`root-status ${cliente.status
                      .toLowerCase()
                      .replace("ç", "c")
                      .replace("ã", "a")}`}
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
  );
}

function PlanosEModulos() {
  return (
    <>
      <section className="root-section-intro">
        <div>
          <span>MODELO COMERCIAL</span>
          <h2>Planos e módulos do ecossistema.</h2>
          <p>
            Controle preços-base, limites, módulos adicionais e quantidade de
            clientes vinculados a cada oferta.
          </p>
        </div>
        <button type="button" className="root-button root-button-primary">
          + Novo plano
        </button>
      </section>

      <section className="root-plans-grid">
        {planosDemonstrativos.map((plano) => (
          <article
            className={`root-plan-card ${plano.destaque ? "is-featured" : ""}`}
            key={plano.nome}
          >
            {plano.destaque && <span className="root-featured-label">MAIS VENDIDO</span>}
            <p>{plano.nome}</p>
            <strong>{formatarMoeda(plano.preco)}<small>/mês</small></strong>
            <span>{plano.descricao}</span>
            <ul>
              {plano.limites.map((limite) => <li key={limite}>✓ {limite}</li>)}
            </ul>
            <footer>
              <span>{plano.clientes} clientes</span>
              <button type="button">Editar plano</button>
            </footer>
          </article>
        ))}
      </section>

      <section className="root-panel">
        <header className="root-panel-header">
          <div>
            <span>CATÁLOGO</span>
            <h3>Módulos comercializáveis</h3>
          </div>
          <button type="button" className="root-button root-button-primary">
            + Novo módulo
          </button>
        </header>

        <div className="root-modules-grid">
          {modulosDemonstrativos.map((modulo) => (
            <article key={modulo.nome}>
              <div>
                <span>{modulo.categoria}</span>
                <strong>{modulo.nome}</strong>
              </div>
              <p>{formatarMoeda(modulo.preco)}/mês</p>
              <small>{modulo.contratos} contratos ativos</small>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function SecaoGenerica({ titulo }) {
  const textos = {
    Contratos: "Controle vigência, renovação, reajustes, valores e módulos contratados.",
    Hospedagem: "Acompanhe ambientes, domínios, armazenamento, backups e disponibilidade.",
    Financeiro: "Consolide faturamento, recorrência, inadimplência e previsões de receita.",
    Implantações: "Gerencie cronogramas, etapas, responsáveis e homologações dos clientes.",
    Suporte: "Centralize chamados, prioridades, SLA e atendimento assistido.",
    Auditoria: "Consulte acessos, alterações, eventos e rastreabilidade da plataforma.",
    Configurações: "Administre portfólios, temas, integrações e parâmetros globais.",
  };

  return (
    <section className="root-empty-state">
      <div className="root-empty-icon">◇</div>
      <span>SPRINT ROOT 1</span>
      <h2>{titulo}</h2>
      <p>{textos[titulo] || "Módulo preparado para evolução nas próximas entregas."}</p>
      <button type="button" className="root-button root-button-primary">
        Iniciar configuração
      </button>
    </section>
  );
}

export default function RootControlCenter() {
  const [secao, setSecao] = useState("Visão executiva");
  const [menuAberto, setMenuAberto] = useState(false);

  function renderizarConteudo() {
    if (secao === "Visão executiva") return <DashboardExecutivo />;
    if (secao === "Clientes") return <ClientesTable />;
    if (secao === "Planos e módulos") return <PlanosEModulos />;
    return <SecaoGenerica titulo={secao} />;
  }

  return (
    <main className="root-control-center">
      <aside className={`root-sidebar ${menuAberto ? "is-open" : ""}`}>
        <div className="root-brand">
          <Image
            src="/branding/nexus-logo.png"
            alt="NEXUS"
            width={54}
            height={54}
            priority
          />
          <div>
            <strong>NEXUS</strong>
            <span>Centro de Controle ROOT</span>
          </div>
        </div>

        <div className="root-profile-badge">
          <span>ROOT</span>
          <div>
            <strong>Fundador</strong>
            <small>Acesso total ao ecossistema</small>
          </div>
        </div>

        <nav>
          {secoes.map((item) => (
            <button
              type="button"
              key={item}
              className={secao === item ? "is-active" : ""}
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

        <div className="root-sidebar-footer">
          <span className="root-online-dot" />
          <div>
            <strong>Plataforma operacional</strong>
            <small>Todos os serviços disponíveis</small>
          </div>
        </div>
      </aside>

      <section className="root-main-content">
        <header className="root-topbar">
          <div className="root-topbar-title">
            <button
              type="button"
              className="root-menu-button"
              onClick={() => setMenuAberto((valor) => !valor)}
              aria-label="Abrir ou fechar menu"
            >
              ☰
            </button>
            <div>
              <p>ECOSSISTEMA INTELIGENTE DE GESTÃO OPERACIONAL</p>
              <h1>{secao}</h1>
            </div>
          </div>

          <div className="root-topbar-actions">
            <button type="button" className="root-notification-button">
              <span>3</span>
              Alertas
            </button>
            <button type="button" className="root-user-button">
              <span>EL</span>
              <div>
                <strong>Elmo Lobão</strong>
                <small>NEXUS ROOT</small>
              </div>
            </button>
          </div>
        </header>

        <div className="root-page-content">
          {renderizarConteudo()}
        </div>
      </section>
    </main>
  );
}
