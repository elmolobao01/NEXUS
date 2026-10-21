"use client";

import { useEffect, useState } from "react";

const sections = ["Visão geral", "Conexões Meta", "Chatbots", "Conversas", "Clientes", "Monitoramento", "Configurações"];
const activeStatuses = new Set(["active", "connected"]);
const formatDate = (date) => date ? new Date(date).toLocaleDateString("pt-BR") : "—";

export default function ChatbotsSection() {
  const [tab, setTab] = useState("Visão geral");
  const [connections, setConnections] = useState([]);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [oauthTestState, setOauthTestState] = useState("idle");
  const [oauthTestMessage, setOauthTestMessage] = useState("");

  async function testOAuthSession() {
    setOauthTestState("loading");
    setOauthTestMessage("");
    try {
      const response = await fetch("/api/integrations/meta/start", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || "Não foi possível criar a sessão OAuth.");
      if (result?.status !== "prepared_not_enabled" || !result?.authorization_url) {
        throw new Error("Resposta inesperada do servidor. A autorização não foi iniciada.");
      }
      // Never navigate to Meta or expose the state-bearing authorization URL.
      setOauthTestState("success");
      setOauthTestMessage("Sessão de teste criada no servidor. Nenhuma conta WhatsApp foi conectada. A sessão expira automaticamente em aproximadamente 10 minutos.");
    } catch (err) {
      setOauthTestState("error");
      setOauthTestMessage(err?.message || "Falha ao preparar a sessão OAuth.");
    }
  }

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function load() {
      setState("loading");
      setError("");
      try {
        const response = await fetch("/api/admin/chatbots/connections", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || "Não foi possível consultar as conexões.");
        if (alive) { setConnections(Array.isArray(data.connections) ? data.connections : []); setState("ready"); }
      } catch (err) {
        if (alive && !controller.signal.aborted) { setState("error"); setError(err.message || "Falha na consulta."); }
      }
    }
    load();
    return () => { alive = false; controller.abort(); };
  }, [reload]);

  const active = connections.filter((item) => activeStatuses.has(String(item.connection_status || "").toLowerCase())).length;
  return (
    <section style={{ display: "grid", gap: 18 }}>
      <div className="root2-hero"><div>
        <span>PLENIUM CHATBOTS · CENTRO DE OPERAÇÕES</span>
        <h2>Atendimento conectado ao seu negócio.</h2>
        <p>Gerencie as conexões WhatsApp, os chatbots contratados e a operação dos clientes em um módulo independente.</p>
      </div></div>
      <nav aria-label="Seções de PLENIUM Chatbots" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12, border: "1px solid #dce5f2", borderRadius: 12, background: "white" }}>
        {sections.map((name) => <button key={name} type="button" onClick={() => setTab(name)} aria-current={tab === name ? "page" : undefined}
          style={{ padding: "10px 13px", border: "1px solid #dce5f2", borderRadius: 9, background: tab === name ? "#eaf2ff" : "#fff", color: "#163a70", cursor: "pointer", fontWeight: tab === name ? 700 : 500 }}>{name}</button>)}
      </nav>
      <div style={{ background: "white", border: "1px solid #dce5f2", borderRadius: 14, padding: 24, minHeight: 220 }}>
        <small style={{ color: "#416da4", fontWeight: 700 }}>PLENIUM CHATBOTS</small>
        <h3 style={{ marginTop: 8 }}>{tab}</h3>
        {tab === "Conexões Meta" ? <>
          <p>Conexões WhatsApp Business vinculadas às organizações cadastradas no NEXUS.</p>
          <p>A ativação de novas conexões permanece indisponível até a conclusão do OAuth e da proteção de credenciais.</p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={() => setReload((v) => v + 1)} disabled={state === "loading"}>Atualizar listagem</button>
            <button type="button" onClick={testOAuthSession} disabled={oauthTestState === "loading"}>
              {oauthTestState === "loading" ? "Preparando sessão..." : "Testar sessão OAuth (sem conectar)"}
            </button>
          </div>
          {oauthTestMessage && <p role="status" aria-live="polite" style={{ marginTop: 12, color: oauthTestState === "error" ? "#9f1239" : "#166534" }}>{oauthTestMessage}</p>}
          <div role="status" style={{ marginTop: 16 }}>
            {state === "loading" ? "Consultando conexões..." : state === "error" ? `Erro: ${error}` : connections.length === 0 ? "Nenhuma conexão WhatsApp cadastrada." : `${connections.length} conexão(ões) cadastrada(s), ${active} com status ativo.`}
          </div>
          {state === "ready" && connections.length > 0 && <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead><tr>{["Organização", "Número", "WABA ID", "Phone Number ID", "Status", "Conectado em"].map((title) => <th key={title} scope="col" style={{ padding: 10, borderBottom: "1px solid #dce5f2" }}>{title}</th>)}</tr></thead>
              <tbody>{connections.map((item) => <tr key={item.id}>
                {[item.organization_name, item.display_phone_number || "—", item.waba_id || "—", item.phone_number_id || "—", item.connection_status || "—", formatDate(item.connected_at)].map((value, index) => <td key={index} style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{value}</td>)}
              </tr>)}</tbody>
            </table>
          </div>}
        </> : tab === "Visão geral" ? <p>Central administrativa em implantação. As conexões serão gerenciadas na aba Conexões Meta; as demais operações serão habilitadas gradualmente.</p> :
          <p>Área preparada para integração com os dados e as permissões do NEXUS. As operações ainda não estão habilitadas.</p>}
      </div>
    </section>
  );
}
