"use client";

import { useState } from "react";
import { ambientesNexus, organizacoesDemo } from "../../core/acessos/configuracao";

export function LoginScreen() {
  const [tipo, setTipo] = useState("cliente");
  const [organizacao, setOrganizacao] = useState(organizacoesDemo[0].id);
  const ambiente = ambientesNexus[tipo];

  function entrar(event) {
    event.preventDefault();
    if (tipo === "admin") {
      window.location.href = "/admin";
      return;
    }
    window.location.href = `/portal?organizacao=${encodeURIComponent(organizacao)}`;
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-top">
          <img src="/branding/nexus-logo.png" alt="NEXUS" />
          <div><strong>NEXUS</strong><span>Ecossistema inteligente de soluções</span></div>
        </div>
        <div className="login-message">
          <span className="login-kicker">Uma plataforma. Múltiplos portfólios.</span>
          <h1>Gestão conectada ao contexto de cada organização.</h1>
          <p>O acesso identifica a organização, a unidade, os módulos contratados e as permissões do usuário antes de carregar o ambiente operacional.</p>
        </div>
        <div className="login-security-note"><span>✓</span><div><strong>Ambientes separados</strong><small>Administração NEXUS e operação dos clientes usam layouts, menus e escopos distintos.</small></div></div>
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={entrar}>
          <span className="eyebrow">Acesso à plataforma</span>
          <h2>Entrar no NEXUS</h2>
          <p>Selecione o ambiente demonstrativo. A autenticação real será conectada ao Supabase Auth.</p>

          <div className="access-type-grid">
            {Object.entries(ambientesNexus).map(([key, item]) => (
              <button className={tipo === key ? "access-type active" : "access-type"} key={key} type="button" onClick={() => setTipo(key)}>
                <strong>{item.nome}</strong><small>{item.descricao}</small>
              </button>
            ))}
          </div>

          <label className="form-field"><span>E-mail</span><input type="email" defaultValue={tipo === "admin" ? "admin@nexus.com.br" : "gestor@cliente.com.br"} /></label>
          <label className="form-field"><span>Senha</span><input type="password" defaultValue="nexus-demo" /></label>

          {tipo === "cliente" && (
            <label className="form-field"><span>Organização demonstrativa</span><select value={organizacao} onChange={(event) => setOrganizacao(event.target.value)}>{organizacoesDemo.map((item) => <option key={item.id} value={item.id}>{item.nome} — {item.unidade}</option>)}</select></label>
          )}

          <button className="login-submit" type="submit">Acessar {ambiente.nome}</button>
          <small className="demo-warning">Ambiente demonstrativo: ainda não há autenticação persistente nem autorização no servidor.</small>
        </form>
      </section>
    </main>
  );
}
