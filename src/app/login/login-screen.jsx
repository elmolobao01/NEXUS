"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginScreen() {
  const router = useRouter();
  const [ambiente, setAmbiente] = useState("cliente");

  function handleSubmit(event) {
    event.preventDefault();
    router.push(ambiente === "admin" ? "/admin" : "/portal");
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-mark">NX</div>
        <p className="login-kicker">ECOSSISTEMA INTELIGENTE DE SOLUÇÕES</p>
        <h1>NEXUS</h1>
        <p>Gestão integrada para organizações, unidades, clientes e portfólios.</p>
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <p className="login-kicker">ACESSO SEGURO</p>
          <h2>Entrar na plataforma</h2>
          <p>Selecione o ambiente e informe suas credenciais.</p>

          <label htmlFor="ambiente">Ambiente</label>
          <select
            id="ambiente"
            value={ambiente}
            onChange={(event) => setAmbiente(event.target.value)}
          >
            <option value="cliente">Portal do Cliente</option>
            <option value="admin">Administração NEXUS</option>
          </select>

          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" placeholder="nome@empresa.com.br" required />

          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" placeholder="Digite sua senha" required />

          <button type="submit">Acessar ambiente</button>
          <small>Versão demonstrativa. A autenticação definitiva será integrada ao Supabase Auth.</small>
        </form>
      </section>
    </main>
  );
}
