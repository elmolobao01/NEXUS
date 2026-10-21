"use client";

import { useEffect, useState } from "react";

const sections = ["Visão geral", "Conexões Meta", "Chatbots", "Conversas", "Clientes", "Monitoramento", "Configurações"];

export default function ChatbotsSection() {
  const [tab, setTab] = useState("Visão geral");
  const [connections, setConnections] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let alive = true;
    // A leitura de conexões requer endpoint próprio com autorização ROOT e isolamento por organização.
    // Não acessar tabelas sensíveis ou credenciais diretamente no navegador.
    if (alive) { setConnections([]); setState("not_configured"); }
    return () => { alive = false; };
  }, []);

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <div className="root2-hero">
        <div>
          <span>PLENIUM CHATBOTS · CENTRO DE OPERAÇÕES</span>
          <h2>Atendimento conectado ao seu negócio.</h2>
          <p>Gerencie as conexões WhatsApp, os chatbots contratados e a operação dos clientes em um módulo independente.</p>
        </div>
      </div>
      <nav aria-label="Seções de PLENIUM Chatbots" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12, border: "1px solid #dce5f2", borderRadius: 12, background: "white" }}>
        {sections.map((name) => (
          <button key={name} type="button" onClick={() => setTab(name)} aria-current={tab === name ? "page" : undefined}
            style={{ padding: "10px 13px", border: "1px solid #dce5f2", borderRadius: 9, background: tab === name ? "#eaf2ff" : "#fff", color: "#163a70", cursor: "pointer", fontWeight: tab === name ? 700 : 500 }}>
            {name}
          </button>
        ))}
      </nav>
      <div style={{ background: "white", border: "1px solid #dce5f2", borderRadius: 14, padding: 24, minHeight: 220 }}>
        <small style={{ color: "#416da4", fontWeight: 700 }}>PLENIUM CHATBOTS</small>
        <h3 style={{ marginTop: 8 }}>{tab}</h3>
        {tab === "Conexões Meta" ? (
          <>
            <p>As conexões WhatsApp Business serão vinculadas individualmente às organizações autorizadas.</p>
            <p role="status">{state === "loading" ? "Carregando..." : "Integração em preparação. A ativação está indisponível até a conclusão do callback OAuth e do armazenamento seguro de credenciais."}</p>
            {connections.length > 0 && <p>{connections.length} conexão(ões) identificada(s).</p>}
          </>
        ) : tab === "Visão geral" ? (
          <p>Central administrativa em implantação. Os indicadores serão apresentados após a integração segura das conexões, contratos e eventos. Nenhuma conexão foi presumida como ativa.</p>
        ) : (
          <p>Área preparada para integração com os dados e as permissões do NEXUS. As operações ainda não estão habilitadas.</p>
        )}
      </div>
    </section>
  );
}
