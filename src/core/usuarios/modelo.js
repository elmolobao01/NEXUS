export const PERFIS_ORGANIZACAO = Object.freeze({
  administrador: { id: "administrador", nome: "Administrador", gerenciaCentral: true },
  gestor: { id: "gestor", nome: "Gestor", gerenciaCentral: false },
  operador: { id: "operador", nome: "Operador", gerenciaCentral: false },
  consulta: { id: "consulta", nome: "Consulta", gerenciaCentral: false },
});

export function criarUsuarioOrganizacao({ id, organizacaoId, nome, email, perfil = "operador", unidades = [], modulos = [] } = {}) {
  if (!id || !organizacaoId || !email) throw new Error("Usuário requer id, organizacaoId e email.");
  return { id, organizacaoId, nome: nome || email, email, perfil, unidades: [...unidades], modulos: [...modulos], ativo: true };
}
