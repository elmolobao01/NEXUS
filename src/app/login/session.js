const SESSION_KEY = "nexus.demo.session";

export function criarSessaoDemonstrativa({ identidade, manterConectado }) {
  if (typeof window === "undefined") return;

  limparSessaoDemonstrativa();

  const storage = manterConectado
    ? window.localStorage
    : window.sessionStorage;

  storage.setItem(
    SESSION_KEY,
    JSON.stringify({
      ...identidade,
      persistente: Boolean(manterConectado),
    })
  );
}

export function obterSessaoDemonstrativa() {
  if (typeof window === "undefined") return null;

  const bruto =
    window.sessionStorage.getItem(SESSION_KEY) ||
    window.localStorage.getItem(SESSION_KEY);

  if (!bruto) return null;

  try {
    return JSON.parse(bruto);
  } catch {
    limparSessaoDemonstrativa();
    return null;
  }
}

export function limparSessaoDemonstrativa() {
  if (typeof window === "undefined") return;

  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(SESSION_KEY);
}
