"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const RECURSOS = [
  { icon: "⌘", title: "Gestão integrada", text: "Pessoas, unidades e processos." },
  { icon: "⚙", title: "Automação", text: "Rotinas operacionais inteligentes." },
  { icon: "◫", title: "Indicadores", text: "Decisões orientadas por dados." },
  { icon: "◇", title: "Multiempresa", text: "Ambientes isolados e escaláveis." },
];

export default function LoginScreen() {
  const router = useRouter();
  const [ambiente, setAmbiente] = useState("cliente");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const contexto = useMemo(
    () =>
      ambiente === "admin"
        ? {
            titulo: "Centro Administrativo NEXUS",
            descricao:
              "Gestão comercial, operacional e tecnológica do ecossistema.",
            destino: "/admin",
          }
        : {
            titulo: "Portal da sua Organização",
            descricao:
              "Acesse os módulos, unidades e recursos contratados.",
            destino: "/portal",
          },
    [ambiente]
  );

  function handleSubmit(event) {
    event.preventDefault();
    setCarregando(true);
    window.setTimeout(() => router.push(contexto.destino), 400);
  }

  return (
    <main className="nexus-login-page nexus-login-v2">
      <section className="nexus-login-visual" aria-label="Apresentação NEXUS">
        <div className="nexus-grid-glow" aria-hidden="true" />
        <div className="nexus-login-orb nexus-login-orb-one" />
        <div className="nexus-login-orb nexus-login-orb-two" />

        <header className="nexus-login-brand">
          <div className="nexus-login-logo-box nexus-logo-premium">
            <Image
              src="/branding/nexus-logo.png"
              alt="Logomarca NEXUS"
              width={96}
              height={96}
              priority
            />
          </div>
          <div>
            <strong>NEXUS</strong>
            <span>Ecossistema Inteligente de Gestão Operacional</span>
          </div>
        </header>

        <div className="nexus-login-presentation">
          <p className="nexus-login-kicker">
            ECOSSISTEMA INTELIGENTE DE GESTÃO OPERACIONAL
          </p>
          <h1>Uma plataforma. Todos os seus processos.</h1>
          <p className="nexus-login-lead">
            O NEXUS integra pessoas, processos, indicadores e automações em um
            único ecossistema, adaptável a diferentes segmentos e estruturas
            organizacionais.
          </p>

          <div className="nexus-login-benefits nexus-benefits-v2">
            {RECURSOS.map((recurso) => (
              <article className="nexus-login-benefit" key={recurso.title}>
                <span aria-hidden="true">{recurso.icon}</span>
                <div>
                  <strong>{recurso.title}</strong>
                  <p>{recurso.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <footer className="nexus-login-visual-footer nexus-login-footer-v2">
          <div>
            <strong>NEXUS Foundation 1.4</strong>
            <span>LGPD • SSL • Backup automático • Multiempresa</span>
          </div>
          <span>© 2026 NEXUS Platform</span>
        </footer>
      </section>

      <section className="nexus-login-access">
        <div className="nexus-login-card nexus-login-card-v2">
          <div className="nexus-login-card-header">
            <span className="nexus-login-security-mark" aria-hidden="true">●</span>
            <p>ACESSO SEGURO</p>
          </div>

          <h2>Bem-vindo ao NEXUS</h2>
          <p className="nexus-login-card-description">
            Escolha o ambiente e informe suas credenciais.
          </p>

          <div
            className="nexus-environment-selector"
            role="group"
            aria-label="Ambiente de acesso"
          >
            <button
              type="button"
              className={ambiente === "cliente" ? "is-selected" : ""}
              onClick={() => setAmbiente("cliente")}
            >
              <span className="nexus-environment-icon" aria-hidden="true">◫</span>
              <span>
                <strong>Cliente</strong>
                <small>Acessar minha organização</small>
              </span>
            </button>

            <button
              type="button"
              className={ambiente === "admin" ? "is-selected" : ""}
              onClick={() => setAmbiente("admin")}
            >
              <span className="nexus-environment-icon" aria-hidden="true">◇</span>
              <span>
                <strong>Administração</strong>
                <small>Gestão interna do NEXUS</small>
              </span>
            </button>
          </div>

          <div className="nexus-login-context">
            <strong>{contexto.titulo}</strong>
            <span>{contexto.descricao}</span>
          </div>

          <form className="nexus-login-form" onSubmit={handleSubmit}>
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
                onClick={() => setMostrarSenha((valor) => !valor)}
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
              {carregando ? "Acessando..." : "Acessar plataforma"}
              {!carregando && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="nexus-login-divider">
            <span>acesso corporativo</span>
          </div>

          <div className="nexus-login-providers">
            <button type="button">Microsoft</button>
            <button type="button">Google</button>
          </div>

          <p className="nexus-login-demo-note">
            Ambiente demonstrativo. A autenticação definitiva utilizará
            Supabase Auth, validação de sessão no servidor e políticas RLS.
          </p>
        </div>
      </section>
    </main>
  );
}
