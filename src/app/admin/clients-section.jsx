"use client";

import { useEffect, useMemo, useState } from "react";

const SEGMENTOS = [
  "Governamental",
  "Educação",
  "Saúde",
  "Hotelaria",
  "Restaurantes",
];

const STATUS = [
  { value: "implementation", label: "Implantação" },
  { value: "active", label: "Ativo" },
  { value: "suspended", label: "Suspenso" },
  { value: "cancelled", label: "Cancelado" },
  { value: "prospect", label: "Prospect" },
];

const FORM_INICIAL = {
  legalName: "",
  tradeName: "",
  documentType: "CNPJ",
  documentNumber: "",
  email: "",
  phone: "",
  segment: "Educação",
  status: "implementation",
  notes: "",
};

function statusLabel(value) {
  return STATUS.find((item) => item.value === value)?.label || value;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export default function ClientsSection({ openRequest = 0 }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients();
    }, 250);

    return () => clearTimeout(timer);
  }, [search, segment, status]);

  async function loadClients() {
    setLoading(true);
    setMessage("");

    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (segment !== "Todos") params.set("segment", segment);
    if (status !== "Todos") params.set("status", status);

    try {
      const response = await fetch(`/api/admin/clientes?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Não foi possível carregar os clientes.");
      }

      setClients(Array.isArray(data.clients) ? data.clients : []);
    } catch (error) {
      setClients([]);
      setMessage(error instanceof Error ? error.message : "Falha ao carregar clientes.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function createClient(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Não foi possível cadastrar o cliente.");
      }

      setModalOpen(false);
      setForm(FORM_INICIAL);
      setMessage("Cliente cadastrado com sucesso.");
      setMessageType("success");
      await loadClients();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao cadastrar cliente.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(clientId, nextStatus) {
    setMessage("");

    try {
      const response = await fetch("/api/admin/clientes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, status: nextStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Não foi possível atualizar o status.");
      }

      setClients((current) =>
        current.map((client) =>
          client.id === clientId ? { ...client, status: nextStatus } : client
        )
      );
      setMessage("Status atualizado.");
      setMessageType("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar status.");
      setMessageType("error");
    }
  }

  const summary = useMemo(() => {
    return {
      total: clients.length,
      active: clients.filter((item) => item.status === "active").length,
      implementation: clients.filter((item) => item.status === "implementation").length,
      suspended: clients.filter((item) => item.status === "suspended").length,
    };
  }, [clients]);

  return (
    <>
      <section className="root2-section-intro root2-clients-intro">
        <div>
          <span>GESTÃO COMERCIAL</span>
          <h2>Clientes NEXUS</h2>
          <p>
            Cadastre organizações, acompanhe implantação e controle a situação
            comercial dos clientes em uma única base.
          </p>
        </div>

        <button
          type="button"
          className="root2-button primary"
          onClick={() => setModalOpen(true)}
        >
          + Novo cliente
        </button>
      </section>

      <section className="root2-client-summary">
        <article>
          <span>Clientes encontrados</span>
          <strong>{loading ? "…" : summary.total}</strong>
          <small>Resultado dos filtros atuais</small>
        </article>
        <article>
          <span>Ativos</span>
          <strong>{loading ? "…" : summary.active}</strong>
          <small>Operação liberada</small>
        </article>
        <article>
          <span>Em implantação</span>
          <strong>{loading ? "…" : summary.implementation}</strong>
          <small>Onboarding em andamento</small>
        </article>
        <article>
          <span>Suspensos</span>
          <strong>{loading ? "…" : summary.suspended}</strong>
          <small>Acesso comercial suspenso</small>
        </article>
      </section>

      {message ? (
        <div className={`root2-client-message ${messageType}`}>{message}</div>
      ) : null}

      <section className="root2-panel root2-client-management">
        <header className="root2-panel-header root2-client-management-header">
          <div>
            <span>CARTEIRA CENTRAL</span>
            <h3>Organizações cadastradas</h3>
          </div>

          <div className="root2-client-filters-v2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, documento ou e-mail"
            />
            <select value={segment} onChange={(event) => setSegment(event.target.value)}>
              <option>Todos</option>
              {SEGMENTOS.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option>Todos</option>
              {STATUS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
        </header>

        <div className="root2-table-wrap">
          <table className="root2-table root2-client-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Segmento</th>
                <th>Documento</th>
                <th>Contato</th>
                <th>Cadastro</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && clients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <strong>{client.trade_name || client.legal_name}</strong>
                    {client.trade_name ? <small>{client.legal_name}</small> : null}
                  </td>
                  <td>{client.segment}</td>
                  <td>
                    <strong>{client.document_type || "—"}</strong>
                    <small>{client.document_number || "Não informado"}</small>
                  </td>
                  <td>
                    <strong>{client.email || "—"}</strong>
                    <small>{client.phone || "Sem telefone"}</small>
                  </td>
                  <td>{formatDate(client.created_at)}</td>
                  <td>
                    <select
                      className={`root2-status-select ${client.status}`}
                      value={client.status}
                      onChange={(event) => updateStatus(client.id, event.target.value)}
                    >
                      {STATUS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}

              {loading ? (
                <tr>
                  <td colSpan="6" className="root2-table-state">
                    Carregando clientes…
                  </td>
                </tr>
              ) : null}

              {!loading && clients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="root2-table-state">
                    Nenhum cliente encontrado. Utilize “+ Novo cliente” para iniciar a carteira.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <div className="root2-modal-backdrop" role="presentation">
          <section className="root2-modal" role="dialog" aria-modal="true" aria-labelledby="novo-cliente-title">
            <header>
              <div>
                <span>NOVO CLIENTE</span>
                <h2 id="novo-cliente-title">Cadastrar organização</h2>
                <p>
                  O cadastro cria automaticamente a organização vinculada ao
                  cliente no núcleo multiempresa do NEXUS.
                </p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Fechar">
                ×
              </button>
            </header>

            <form onSubmit={createClient}>
              <div className="root2-form-grid">
                <label className="span-2">
                  <span>Razão social / Nome *</span>
                  <input
                    required
                    value={form.legalName}
                    onChange={(event) => setForm({ ...form, legalName: event.target.value })}
                    placeholder="Nome oficial da organização"
                  />
                </label>

                <label className="span-2">
                  <span>Nome fantasia</span>
                  <input
                    value={form.tradeName}
                    onChange={(event) => setForm({ ...form, tradeName: event.target.value })}
                    placeholder="Nome comercial"
                  />
                </label>

                <label>
                  <span>Tipo de documento</span>
                  <select
                    value={form.documentType}
                    onChange={(event) => setForm({ ...form, documentType: event.target.value })}
                  >
                    <option>CNPJ</option>
                    <option>CPF</option>
                    <option>Outro</option>
                  </select>
                </label>

                <label>
                  <span>Documento</span>
                  <input
                    value={form.documentNumber}
                    onChange={(event) => setForm({ ...form, documentNumber: event.target.value })}
                    placeholder="Somente identificação"
                  />
                </label>

                <label>
                  <span>Segmento *</span>
                  <select
                    required
                    value={form.segment}
                    onChange={(event) => setForm({ ...form, segment: event.target.value })}
                  >
                    {SEGMENTOS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>

                <label>
                  <span>Situação inicial</span>
                  <select
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                  >
                    {STATUS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>E-mail</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="contato@empresa.com.br"
                  />
                </label>

                <label>
                  <span>Telefone</span>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </label>

                <label className="span-2">
                  <span>Observações</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    placeholder="Informações comerciais ou de implantação"
                    rows="4"
                  />
                </label>
              </div>

              <footer>
                <button
                  type="button"
                  className="root2-button neutral"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="root2-button primary"
                  disabled={saving}
                >
                  {saving ? "Cadastrando…" : "Cadastrar cliente"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
