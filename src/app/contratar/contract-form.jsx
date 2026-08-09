"use client";

import { useMemo, useState } from "react";

const WHATSAPP = "5571999952478";

const productLabels = {
  gestao: "NEXUS Gestão",
  ia: "NEXUS IA",
  combo: "NEXUS Gestão + NEXUS IA",
};

export default function ContractForm({ initialProduct = "gestao", origem = "site" }) {
  const [produto, setProduto] = useState(initialProduct);
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  const whatsappHref = useMemo(() => {
    const msg = [
      "Olá! Quero iniciar uma contratação NEXUS.",
      `Produto: ${productLabels[produto]}`,
      `Nome: ${nome || "não informado"}`,
      `Empresa: ${empresa || "não informada"}`,
      `E-mail: ${email || "não informado"}`,
      `Telefone: ${telefone || "não informado"}`,
      origem === "cliente" ? "Origem: cliente NEXUS existente / adicionar produto" : "Origem: site público",
    ].join("\n");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }, [produto, nome, empresa, email, telefone, origem]);

  return (
    <form className="contract-form" onSubmit={(event) => { event.preventDefault(); window.open(whatsappHref, "_blank", "noopener,noreferrer"); }}>
      <label><span>Produto de interesse</span><select value={produto} onChange={(e) => setProduto(e.target.value)}><option value="gestao">NEXUS Gestão</option><option value="ia">NEXUS IA</option><option value="combo">Gestão + IA</option></select></label>
      <div className="contract-grid">
        <label><span>Nome</span><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" required /></label>
        <label><span>Empresa</span><input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Empresa ou organização" /></label>
        <label><span>E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com.br" required /></label>
        <label><span>WhatsApp</span><input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(71) 99999-9999" required /></label>
      </div>
      <button type="submit" className="home-primary-button contract-submit">Iniciar contratação</button>
      <small>A finalização comercial, condições e ativação do produto serão confirmadas pelo atendimento NEXUS.</small>
    </form>
  );
}
