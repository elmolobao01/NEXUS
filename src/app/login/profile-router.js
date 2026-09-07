const DESTINOS_POR_PERFIL = {
  PLENIUM_ROOT: "/admin",
  PLENIUM_ADMIN: "/admin",
  CLIENT_ADMIN: "/portal",
  MANAGER: "/portal",
  SUPERVISOR: "/portal",
  OPERATOR: "/portal",
  VIEWER: "/portal",
};

export function resolverDestinoDoPerfil(identidade) {
  if (!identidade?.perfil) return "/login";

  return DESTINOS_POR_PERFIL[identidade.perfil] || "/portal";
}
