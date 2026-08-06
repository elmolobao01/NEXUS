"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

const recursos = [
  {
    icon: "⌘",
    title: "Gestão integrada",
    description: "Pessoas, unidades e processos.",
  },
  {
    icon: "⚙",
    title: "Automação",
    description: "Rotinas operacionais inteligentes.",
  },
  {
    icon: "◫",
    title: "Indicadores",
    description: "Decisões orientadas por dados.",
  },
  {
    icon: "◇",
    title: "Multiempresa",
    description: "Ambientes isolados e escaláveis.",
  },
];

function identificarDestino(email) {
  const emailNormalizado = email.trim().toLowerCase();

  // Simulação temporária até a integração com Supabase Auth e RBAC.
  // Contas internas da NEXUS seguem para o Centro de Controle.
  if (
    emailNormalizado.endsWith("@nexus.com.br") ||
    emailNormalizado.includes("elmolobao") ||
    emailNormalizado.includes("root")
  ) {
    return "/admin";
  }

  return "/portal";
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    setMensagem("");
    setCarregando(true);

    const destino = identificarDestino(email);

    window.setTimeout(() => {
      router.push(destino);
    }, 450);
  }

  return (
    <main className="nexus-login-page nexus-login-inteligente">
      <section className="nexus-login-visual" aria-label="Apresentação NEXUS">
        <div className="nexus-grid-glow" aria-hidden="true" />
        <div className="nexus-login-orb nexus-login-orb-one" aria-hidden="true" />
        <div className="nexus-login-orb nexus-login-orb-two" aria-hidden="true" />

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

          <h1>Uma plataforma que se adapta ao seu negócio.</h1>

          <p className="nexus-login-lead">
            Transformando operações complexas em decisões inteligentes.
          </p>

          <div className="nexus-login-benefits nexus-benefits-v2">
            {recursos.map((recurso) => (
              <article className="nexus-login-benefit" key={recurso.title}>
                <span aria-hidden="true">{recurso.icon}</span>
                <div>
                  <strong>{recurso.title}</strong>
                  <p>{recurso.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <footer className="nexus-login-visual-footer nexus-login-footer-v2">
          <div>
            <strong>NEXUS Foundation 1.4</strong>
            <span>
              LGPD • SSL • Backup automático • Multiempresa • 99,9% de disponibilidade
            </span>
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
          <p className="nexus-login-concept">
            Um novo conceito em gestão operacional.
          </p>
          <p className="nexus-login-card-description">
            Acesse sua conta para continuar.
          </p>

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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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

            {mensagem ? (
              <p className="nexus-login-message" role="alert">
                {mensagem}
              </p>
            ) : null}

            <button
              className="nexus-login-submit"
              type="submit"
              disabled={carregando}
            >
              {carregando ? "Identificando seu ambiente..." : "Iniciar sessão"}
              {!carregando && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="nexus-login-divider">
            <span>ou continue com</span>
          </div>

          <div className="nexus-login-providers">
            <button type="button">Entrar com Microsoft</button>
            <button type="button">Entrar com Google</button>
          </div>

          <p className="nexus-login-demo-note">
            O NEXUS identificará automaticamente sua organização, perfil,
            módulos contratados e ambiente de trabalho.
          </p>
        </div>
      </section>
    </main>
  );
}
