"use client";
import { useCallback, useEffect, useState } from "react";

export default function WhatsAppConversations() {
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [eventCount, setEventCount] = useState(0);
  const [readiness, setReadiness] = useState(null);
  const [readinessError, setReadinessError] = useState("");
  const [checking, setChecking] = useState(false);
  const checkReadiness = useCallback(async () => {
    setChecking(true); setReadinessError("");
    try {
      const res = await fetch("/api/admin/chatbots/readiness", { credentials: "same-origin", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível consultar a prontidão.");
      setReadiness(data);
    } catch (err) { setReadiness(null); setReadinessError(err.message || "Consulta indisponível."); }
    finally { setChecking(false); }
  }, []);
  const load = useCallback(async (signal) => {
    setState("loading"); setError("");
    try {
      const response = await fetch("/api/admin/chatbots/conversations", { credentials: "same-origin", cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Falha ao consultar mensagens.");
      setItems(Array.isArray(result.messages) ? result.messages : []);
      setEventCount(Number(result.event_count || 0));
      setState("ready");
    } catch (err) {
      if (err.name !== "AbortError") { setError(err.message || "Erro de consulta."); setState("error"); }
    }
  }, []);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  const fmt = (timestamp) => timestamp ? new Date(timestamp * 1000).toLocaleString("pt-BR") : "Data não informada";
  return <section aria-label="Mensagens recebidas do WhatsApp oficial" style={{ display: "grid", gap: 12 }}>
    <p>Mensagens registradas pelo webhook do número oficial +55 71 99941-2478. Visualização somente leitura; respostas e envios automáticos permanecem desativados.</p>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button type="button" onClick={() => load()} disabled={state === "loading"}>{state === "loading" ? "Consultando..." : "Atualizar mensagens"}</button>
      <button type="button" onClick={checkReadiness} disabled={checking}>{checking ? "Verificando..." : "Verificar prontidão do chatbot"}</button>
    </div>
    {readinessError && <p role="alert">{readinessError}</p>}
    {readiness && <aside aria-label="Prontidão do chatbot" style={{ border: "1px solid #dce5f2", borderRadius: 10, padding: 14 }}>
      <strong>Diagnóstico operacional (somente leitura)</strong>
      <p>Conexão oficial: {readiness.connections?.some(c => c.phone_number_id === "1453993444467017" && c.status === "active" && c.credential_linked) ? "ativa e vinculada" : "não confirmada"}.</p>
      <p>Contrato: {readiness.entitlement_plan || "não informado"} · Configuração ativa: {readiness.chatbot_config_active ? "sim" : "não"} · Franquia elegível: {readiness.wallet?.eligible ? "sim" : "não"}.</p>
      <p><strong>Envio automático: desativado.</strong> A consulta não envia mensagens nem debita créditos.</p>
      {Array.isArray(readiness.next_blockers) && readiness.next_blockers.length > 0 && <p>Bloqueios atuais: {readiness.next_blockers.join(", ")}.</p>}
    </aside>}
    {state === "error" && <p role="alert" style={{ color: "#9f1239" }}>{error}</p>}
    {state === "ready" && <p role="status">{items.length} mensagem(ns) encontrada(s) em {eventCount} evento(s) recentes.</p>}
    {state === "ready" && items.length === 0 && <p>Nenhuma mensagem registrada para o número oficial. Isso não confirma que o webhook esteja recebendo mensagens; verifique os logs se já enviou um teste real.</p>}
    {state === "ready" && items.map((item, i) => <article key={`${item.id}-${i}`} style={{ border: "1px solid #dce5f2", borderRadius: 10, padding: 14, background: "#f8fbff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <strong>{item.name || item.from || "Contato sem identificação"}</strong>
        <span>{fmt(item.timestamp)}</span>
      </div>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginBottom: 6 }}>{item.body}</p>
      <small>{item.direction === "echo" ? "Eco do WhatsApp Business" : "Recebida"} · {item.processing_status || "Status não informado"}</small>
    </article>)}
  </section>;
}
