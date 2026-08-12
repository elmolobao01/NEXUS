"use client";

import { useEffect, useMemo, useState } from "react";
import "./clients-responsaveis.css";

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

const TIPOS_RESPONSAVEL = [
  "Administrativo",
  "Financeiro",
  "Contratual",
  "Técnico",
  "Implantação",
  "Outro",
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

function novoResponsavel(principal = false) {
  return {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    role: "",
    types: [],
    email: "",
    phone: "",
    whatsapp: "",
    samePhone: false,
    principal,
  };
}

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function formatCpf(value = "") {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatCnpj(value = "") {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatDocument(value, type) {
  if (type === "CPF") return formatCpf(value);
  if (type === "CNPJ") return formatCnpj(value);
  return onlyDigits(value);
}

function formatPhone(value = "") {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  for (let t = 9; t < 11; t += 1) {
    let sum = 0;
    for (let i = 0; i < t; i += 1) {
      sum += Number(cpf[i]) * ((t + 1) - i);
    }
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== Number(cpf[t])) return false;
  }

  return true;
}

function isValidCnpj(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (base) => {
    let factor = base.length - 7;
    let total = 0;
    for (const digit of base) {
      total += Number(digit) * factor--;
      if (factor < 2) factor = 9;
    }
    const rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calc(cnpj.slice(0, 12));
  const d2 = calc(cnpj.slice(0, 12) + d1);
  return cnpj.endsWith(`${d1}${d2}`);
}

function isValidDocument(value, type) {
  if (!value) return true;
  if (type === "CPF") return isValidCpf(value);
  if (type === "CNPJ") return isValidCnpj(value);
  return onlyDigits(value).length > 0;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export default function ClientsSection() {
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
  const [responsaveis, setResponsaveis] = useState([]);
  const [editingClientId, setEditingClientId] = useState(null);
  const [activeTab, setActiveTab] = useState("dados");

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

  function abrirCadastro() {
    setEditingClientId(null);
    setActiveTab("dados");
    setForm(FORM_INICIAL);
    setResponsaveis([]);
    setMessage("");
    setModalOpen(true);
  }

  async function abrirFicha(client) {
    setEditingClientId(client.id);
    setActiveTab("dados");
    setMessage("");
    setForm({
      legalName: client.legal_name || "",
      tradeName: client.trade_name || "",
      documentType: client.document_type || "CNPJ",
      documentNumber: onlyDigits(client.document_number || ""),
      email: client.email || "",
      phone: onlyDigits(client.phone || ""),
      segment: client.segment || "Educação",
      status: client.status || "implementation",
      notes: client.notes || "",
    });
    try {
      const response = await fetch(`/api/admin/clientes?clientId=${encodeURIComponent(client.id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Não foi possível carregar a ficha do cliente.");
      setResponsaveis((data.responsaveis || []).map((item) => ({
        localId: item.id || `${Date.now()}-${Math.random()}`,
        id: item.id, name: item.name || "", role: item.role || "", types: item.types || [],
        email: item.email || "", phone: item.phone || "", whatsapp: item.whatsapp || "",
        samePhone: Boolean(item.phone && item.phone === item.whatsapp), principal: Boolean(item.principal),
      })));
      setModalOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar ficha.");
      setMessageType("error");
    }
  }

  function adicionarResponsavel() {
    setResponsaveis((current) => [
      ...current,
      novoResponsavel(current.length === 0),
    ]);
  }

  function removerResponsavel(localId) {
    setResponsaveis((current) => {
      const removing = current.find((item) => item.localId === localId);
      const next = current.filter((item) => item.localId !== localId);

      if (removing?.principal && next.length > 0) {
        next[0] = { ...next[0], principal: true };
      }

      return next;
    });
  }

  function atualizarResponsavel(localId, patch) {
    setResponsaveis((current) =>
      current.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item
      )
    );
  }

  function definirPrincipal(localId) {
    setResponsaveis((current) =>
      current.map((item) => ({
        ...item,
        principal: item.localId === localId,
      }))
    );
  }

  function alternarTipo(localId, tipo) {
    setResponsaveis((current) =>
      current.map((item) => {
        if (item.localId !== localId) return item;
        const exists = item.types.includes(tipo);
        return {
          ...item,
          types: exists
            ? item.types.filter((value) => value !== tipo)
            : [...item.types, tipo],
        };
      })
    );
  }

  async function saveClient(event) {
    event.preventDefault();
    setMessage("");

    if (!isValidDocument(form.documentNumber, form.documentType)) {
      setMessage(`Informe um ${form.documentType} válido.`);
      setMessageType("error");
      return;
    }

    const incomplete = responsaveis.find(
      (item) =>
        !item.name.trim() ||
        !item.role.trim() ||
        item.types.length === 0 ||
        !item.email.trim()
    );

    if (incomplete) {
      setMessage(
        "Complete Nome, Função/Cargo, Tipo de responsável e E-mail de todos os responsáveis adicionados."
      );
      setMessageType("error");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/clientes", {
        method: editingClientId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingClientId ? { clientId: editingClientId } : {}),
          ...form,
          documentNumber: onlyDigits(form.documentNumber),
          phone: onlyDigits(form.phone),
          responsaveis: responsaveis.map((item) => ({
            name: item.name.trim(),
            role: item.role.trim(),
            types: item.types,
            email: item.email.trim().toLowerCase(),
            phone: onlyDigits(item.phone),
            whatsapp: onlyDigits(item.samePhone ? item.phone : item.whatsapp),
            principal: Boolean(item.principal),
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || (editingClientId ? "Não foi possível atualizar o cliente." : "Não foi possível cadastrar o cliente."));
      }

      setModalOpen(false);
      setForm(FORM_INICIAL);
      setResponsaveis([]);
      setMessage(editingClientId ? "Cliente atualizado com sucesso." : "Cliente cadastrado com sucesso.");
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

  const summary = useMemo(() => ({
    total: clients.length,
    active: clients.filter((item) => item.status === "active").length,
    implementation: clients.filter((item) => item.status === "implementation").length,
    suspended: clients.filter((item) => item.status === "suspended").length,
  }), [clients]);

  const documentPlaceholder =
    form.documentType === "CPF"
      ? "000.000.000-00"
      : form.documentType === "CNPJ"
        ? "00.000.000/0000-00"
        : "Somente números";

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
          onClick={abrirCadastro}
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
                    <button type="button" className="nexus-client-link" onClick={() => abrirFicha(client)}><strong>{client.trade_name || client.legal_name}</strong></button>
                    {client.trade_name ? <small>{client.legal_name}</small> : null}
                  </td>
                  <td>{client.segment}</td>
                  <td>
                    <strong>{client.document_type || "—"}</strong>
                    <small>
                      {client.document_number
                        ? formatDocument(client.document_number, client.document_type)
                        : "Não informado"}
                    </small>
                  </td>
                  <td>
                    <strong>{client.email || "—"}</strong>
                    <small>{client.phone ? formatPhone(client.phone) : "Sem telefone"}</small>
                  </td>
                  <td>{formatDate(client.created_at)}</td>
                  <td>
                    <select
                      className={`root2-status-select ${client.status}`}
                      value={client.status}
                      onChange={(event) => updateStatus(client.id, event.target.value)}
                    >
                      {STATUS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </td>
                  <td><button type="button" className="nexus-access-button" onClick={() => { setMessage("Configuração de acesso será vinculada aos usuários desta organização."); setMessageType("info"); }}>Configurar acesso</button></td>
                </tr>
              ))}

              {loading ? (
                <tr>
                  <td colSpan="7" className="root2-table-state">Carregando clientes…</td>
                </tr>
              ) : null}

              {!loading && clients.length === 0 ? (
                <tr>
                  <td colSpan="7" className="root2-table-state">
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
          <section
            className="root2-modal root2-modal-client-v11"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cliente-title"
          >
            <header>
              <div>
                <span>{editingClientId ? "FICHA DO CLIENTE" : "NOVO CLIENTE"}</span>
                <h2 id="cliente-title">{editingClientId ? "Gerenciar organização" : "Cadastrar organização"}</h2>
                <p>
                  Cadastre a organização e, opcionalmente, todos os responsáveis
                  que atuarão no relacionamento com o NEXUS.
                </p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Fechar">
                ×
              </button>
            </header>

            <div className="nexus-client-tabs"><button type="button" className={activeTab === "dados" ? "active" : ""} onClick={() => setActiveTab("dados")}>Dados da organização</button><button type="button" className={activeTab === "responsaveis" ? "active" : ""} onClick={() => setActiveTab("responsaveis")}>Responsáveis</button><button type="button" className={activeTab === "acesso" ? "active" : ""} onClick={() => setActiveTab("acesso")}>Acesso</button><button type="button" className={activeTab === "historico" ? "active" : ""} onClick={() => setActiveTab("historico")}>Histórico</button></div>
            <form onSubmit={saveClient}>
              {activeTab === "dados" ? <>
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
                    onChange={(event) =>
                      setForm({
                        ...form,
                        documentType: event.target.value,
                        documentNumber: "",
                      })
                    }
                  >
                    <option>CNPJ</option>
                    <option>CPF</option>
                    <option>Outro</option>
                  </select>
                </label>

                <label>
                  <span>Documento</span>
                  <input
                    inputMode="numeric"
                    value={formatDocument(form.documentNumber, form.documentType)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        documentNumber: onlyDigits(event.target.value),
                      })
                    }
                    placeholder={documentPlaceholder}
                    maxLength={form.documentType === "CPF" ? 14 : form.documentType === "CNPJ" ? 18 : 30}
                  />
                  {form.documentNumber &&
                  !isValidDocument(form.documentNumber, form.documentType) ? (
                    <small className="nexus-field-error">
                      {form.documentType} inválido.
                    </small>
                  ) : null}
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
                  <span>E-mail institucional</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="contato@empresa.com.br"
                  />
                </label>

                <label>
                  <span>Telefone institucional</span>
                  <input
                    inputMode="tel"
                    value={formatPhone(form.phone)}
                    onChange={(event) =>
                      setForm({ ...form, phone: onlyDigits(event.target.value) })
                    }
                    placeholder="(00) 00000-0000"
                  />
                </label>
              </div>

              </> : null}
              {activeTab === "responsaveis" ? <section className="nexus-responsaveis-section">
                <div className="nexus-responsaveis-heading">
                  <div>
                    <span>RESPONSÁVEIS</span>
                    <h3>Contatos da organização</h3>
                    <p>
                      Adicione quantos responsáveis forem necessários. Uma mesma
                      pessoa pode exercer mais de um tipo de responsabilidade.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="root2-button neutral"
                    onClick={adicionarResponsavel}
                  >
                    + Adicionar responsável
                  </button>
                </div>

                {responsaveis.length === 0 ? (
                  <div className="nexus-responsaveis-empty">
                    Nenhum responsável adicionado.
                  </div>
                ) : (
                  <div className="nexus-responsaveis-list">
                    {responsaveis.map((responsavel, index) => (
                      <article className="nexus-responsavel-card" key={responsavel.localId}>
                        <header>
                          <div>
                            <span>RESPONSÁVEL {String(index + 1).padStart(2, "0")}</span>
                            <strong>
                              {responsavel.name || "Novo responsável"}
                            </strong>
                          </div>

                          <div className="nexus-responsavel-actions">
                            <label className="nexus-principal-toggle">
                              <input
                                type="radio"
                                name="responsavel-principal"
                                checked={responsavel.principal}
                                onChange={() => definirPrincipal(responsavel.localId)}
                              />
                              <span>Responsável principal</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => removerResponsavel(responsavel.localId)}
                            >
                              Remover
                            </button>
                          </div>
                        </header>

                        <div className="nexus-responsavel-grid">
                          <label>
                            <span>Nome *</span>
                            <input
                              required
                              value={responsavel.name}
                              onChange={(event) =>
                                atualizarResponsavel(responsavel.localId, {
                                  name: event.target.value,
                                })
                              }
                              placeholder="Nome completo"
                            />
                          </label>

                          <label>
                            <span>Função/Cargo *</span>
                            <input
                              required
                              value={responsavel.role}
                              onChange={(event) =>
                                atualizarResponsavel(responsavel.localId, {
                                  role: event.target.value,
                                })
                              }
                              placeholder="Ex.: Diretor, Gerente, Proprietário"
                            />
                          </label>

                          <label className="span-2">
                            <span>Tipo de responsável *</span>
                            <div className="nexus-responsavel-types">
                              {TIPOS_RESPONSAVEL.map((tipo) => {
                                const checked = responsavel.types.includes(tipo);
                                return (
                                  <button
                                    type="button"
                                    key={tipo}
                                    className={checked ? "active" : ""}
                                    onClick={() =>
                                      alternarTipo(responsavel.localId, tipo)
                                    }
                                  >
                                    {checked ? "✓ " : ""}{tipo}
                                  </button>
                                );
                              })}
                            </div>
                          </label>

                          <label className="span-2">
                            <span>E-mail *</span>
                            <input
                              required
                              type="email"
                              value={responsavel.email}
                              onChange={(event) =>
                                atualizarResponsavel(responsavel.localId, {
                                  email: event.target.value,
                                })
                              }
                              placeholder="responsavel@empresa.com.br"
                            />
                          </label>

                          <label>
                            <span>Telefone</span>
                            <input
                              inputMode="tel"
                              value={formatPhone(responsavel.phone)}
                              onChange={(event) => {
                                const phone = onlyDigits(event.target.value);
                                atualizarResponsavel(responsavel.localId, {
                                  phone,
                                  whatsapp: responsavel.samePhone
                                    ? phone
                                    : responsavel.whatsapp,
                                });
                              }}
                              placeholder="(00) 00000-0000"
                            />
                          </label>

                          <label>
                            <span>WhatsApp</span>
                            <input
                              inputMode="tel"
                              disabled={responsavel.samePhone}
                              value={formatPhone(
                                responsavel.samePhone
                                  ? responsavel.phone
                                  : responsavel.whatsapp
                              )}
                              onChange={(event) =>
                                atualizarResponsavel(responsavel.localId, {
                                  whatsapp: onlyDigits(event.target.value),
                                })
                              }
                              placeholder="(00) 00000-0000"
                            />
                            <label className="nexus-same-phone">
                              <input
                                type="checkbox"
                                checked={responsavel.samePhone}
                                onChange={(event) =>
                                  atualizarResponsavel(responsavel.localId, {
                                    samePhone: event.target.checked,
                                    whatsapp: event.target.checked
                                      ? responsavel.phone
                                      : responsavel.whatsapp,
                                  })
                                }
                              />
                              <span>Mesmo número do telefone</span>
                            </label>
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section> : null}

              {activeTab === "dados" ? <section className="nexus-observacoes-final">
                <label>
                  <span>Observações</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    placeholder="Informações comerciais ou de implantação"
                    rows="4"
                  />
                </label>
              </section> : null}
              {activeTab === "acesso" ? <section className="nexus-tab-placeholder"><h3>Usuários de acesso</h3><p>Área reservada para vincular usuários que poderão entrar no NEXUS em nome desta organização. Responsáveis comerciais não recebem acesso automaticamente.</p></section> : null}
              {activeTab === "historico" ? <section className="nexus-tab-placeholder"><h3>Histórico da organização</h3><p>Alterações cadastrais e administrativas serão registradas nesta área pela camada de auditoria.</p></section> : null}

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
                  {saving ? "Salvando…" : editingClientId ? "Salvar alterações" : "Cadastrar cliente"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
