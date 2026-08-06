import Link from "next/link";

export const metadata = {
  title: "Acesso negado | NEXUS",
};

export default function AccessDeniedPage() {
  return (
    <main className="nexus-access-denied">
      <section className="nexus-access-denied-card">
        <span aria-hidden="true">!</span>
        <h1>Acesso não autorizado</h1>
        <p>
          Seu perfil não possui permissão para acessar este ambiente.
          Entre novamente ou solicite autorização ao administrador.
        </p>
        <Link href="/login">Voltar ao login</Link>
      </section>
    </main>
  );
}
