"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

const benefits = [
  "Gestão integrada",
  "Automação de processos",
  "Indicadores inteligentes",
  "Ambientes multiempresa",
];

export default function LoginScreen() {
  const router = useRouter();
  const [ambiente, setAmbiente] = useState("cliente");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setCarregando(true);

    window.setTimeout(() => {
      router.push(ambiente === "admin" ? "/admin" : "/portal");
    }, 450);
  }

  return (
    <main className="nexus-login-page">
      <section className="nexus-login-visual" aria-label="Apresentação da plataforma">
        <div className="nexus-login-orb nexus-login-orb-one" />
        <div className="nexus-login-orb nexus-login-orb-two" />

        <header className="nexus-login-brand">
          <div className="nexus-login-logo-box">
            <Image
              src="/branding/nexus-logo.png"
              alt="Logomarca NEXUS"
              width={72}
              height={72}
              priority
            />
          </div>

          <div>
            <strong>NEXUS</strong>
            <span>Plataforma Inteligente de Gestão</span>
          </div>
        </header>

        <div className="nexus-login-presentation">
          <p className="nexus-login-kicker">ECOSSISTEMA INTELIGENTE DE SOLUÇÕES</p>
          <h1>Conecte pessoas, processos e resultados.</h1>
          <p className="nexus-login-lead">
            Uma única plataforma para administrar organizações, unidades,
            usuários e portfólios especializados com clareza e segurança.
          </p>

          <div className="nexus-login-benefits">
            {benefits.map((benefit) => (
              <div className="nexus-login-benefit" key={benefit}>
                <span aria-hidden="true">✓</span>
                <p>{benefit}</p>
              </div>
            ))}
          </div>
        </div>

        <footer className="nexus-login-visual-footer">
          <span>Fundação 1.3</span>
          <span>© 2026 NEXUS</span>
        </footer>
      </section>

      <section className="nexus-login-access">
        <div className="nexus-login-card">
          <div className="nexus-login-card-header">
            <span className="nexus-login-security-mark" aria-hidden="true">●</span>
            <p>ACESSO SEGURO</p>
          </div>

          <h2>Bem-vindo</h2>
          <p className="nexus-login-card-description">
            Selecione seu ambiente e informe suas credenciais para continuar.
          </p>

          <div className="nexus-environment-selector" role="group" aria-label="Ambiente de acesso">
            <button
              type="button"
              className={ambiente === "cliente" ? "is-selected" : ""}
              onClick={() => setAmbiente("cliente")}
            >
              <span className="nexus-environment-icon" aria-hidden="true">◫</span>
              <span>
                <strong>Portal do Cliente</strong>
                <small>Operação da organização</small>
              </span>
            </button>

            <button
              type="button"
              className={ambiente === "admin" ? "is-selected" : ""}
              onClick={() => setAmbiente("admin")}
            >
              <span className="nexus-environment-icon" aria-hidden="true">◇</span>
              <span>
                <strong>Administração NEXUS</strong>
                <small>Gestão interna da plataforma</small>
              </span>
            </button>
          </div>

          <form className="nexus-login-form" onSubmit={handleSubmit}>
            <input type="hidden" name="ambiente" value={ambiente} />

            <label htmlFor="email">E-mail</label>
            <div className="nexus-login-input-wrap">
              <span aria-hidden="true">@</span>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="nome@empresa.com.br"
                autoComplete="email"
                required
              />
            </div>

            <label htmlFor="senha">Senha</label>
            <div className="nexus-login-input-wrap">
              <span aria-hidden="true">●</span>
              <input
                id="senha"
                name="senha"
                type={mostrarSenha ? "text" : "password"}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="nexus-password-toggle"
                onClick={() => setMostrarSenha((value) => !value)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            <div className="nexus-login-options">
              <label className="nexus-checkbox">
                <input type="checkbox" name="manterConectado" />
                <span>Manter conectado</span>
              </label>
              <button type="button" className="nexus-link-button">
                Esqueci minha senha
              </button>
            </div>

            <button className="nexus-login-submit" type="submit" disabled={carregando}>
              {carregando ? "Acessando..." : "Entrar na plataforma"}
              {!carregando && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="nexus-login-divider"><span>acesso corporativo</span></div>

          <div className="nexus-login-providers">
            <button type="button">Microsoft</button>
            <button type="button">Google</button>
          </div>

          <p className="nexus-login-demo-note">
            Versão demonstrativa. A autenticação definitiva será integrada ao
            Supabase Auth com políticas de acesso por organização, unidade e perfil.
          </p>
        </div>
      </section>
    </main>
  );
}
