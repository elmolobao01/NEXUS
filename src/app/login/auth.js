const TEMPO_SIMULACAO_MS = 450;

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function identificarPerfilDemonstrativo(email) {
  if (
    email.includes("root") ||
    email.includes("elmolobao") ||
    email.endsWith("@nexus.com.br")
  ) {
    return {
      perfil: "NEXUS_ROOT",
      organizacaoId: "nexus-platform",
      organizacaoNome: "NEXUS Platform",
      unidadeId: null,
      portfolio: "administracao",
      modulos: ["core", "comercial", "financeiro", "auditoria", "infraestrutura"],
    };
  }

  if (email.includes("admin")) {
    return {
      perfil: "CLIENT_ADMIN",
      organizacaoId: "org-demonstracao",
      organizacaoNome: "Organização Demonstração",
      unidadeId: "unidade-principal",
      portfolio: "educacao",
      modulos: ["dashboard", "usuarios", "contratos", "relatorios"],
    };
  }

  return {
    perfil: "OPERATOR",
    organizacaoId: "org-demonstracao",
    organizacaoNome: "Organização Demonstração",
    unidadeId: "unidade-principal",
    portfolio: "educacao",
    modulos: ["dashboard", "operacao"],
  };
}

export async function autenticarUsuario({ email, senha }) {
  const emailNormalizado = normalizarEmail(email);

  if (!emailNormalizado || !emailNormalizado.includes("@")) {
    throw new Error("Informe um e-mail válido.");
  }

  if (!senha || senha.length < 4) {
    throw new Error("A senha deve possuir pelo menos 4 caracteres.");
  }

  await new Promise((resolve) => window.setTimeout(resolve, TEMPO_SIMULACAO_MS));

  const contexto = identificarPerfilDemonstrativo(emailNormalizado);

  return {
    id: `demo-${btoa(emailNormalizado).replace(/=/g, "").slice(0, 18)}`,
    email: emailNormalizado,
    nome: contexto.perfil === "NEXUS_ROOT" ? "Elmo Lobão" : "Usuário Demonstração",
    ...contexto,
    autenticadoEm: new Date().toISOString(),
  };
}
