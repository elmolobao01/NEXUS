export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !anon || !service) return reply({ message: "Serviço não configurado." }, 503);
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!token) return reply({ message: "Faça login no NEXUS." }, 401);
  const userHeaders = { apikey: anon, Authorization: `Bearer ${token}` };
  try {
    const identity = await fetch(`${base}/auth/v1/user`, { headers: userHeaders, cache: "no-store" });
    if (!identity.ok) return reply({ message: "Sessão inválida." }, 401);
    const user = await identity.json();
    if (!user?.id) return reply({ message: "Sessão inválida." }, 401);
    const adminHeaders = { apikey: service, Authorization: `Bearer ${service}` };
    // The authenticated user ID, never an arbitrary browser-supplied user ID,
    // determines the authorization context. ROOT-only endpoint for ROOT console.
    const membership = await fetch(`${base}/rest/v1/nexus_user_profiles?select=profile,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true`, { headers: adminHeaders, cache: "no-store" });
    if (!membership.ok) return reply({ message: "Não foi possível validar permissões." }, 503);
    const profiles = await membership.json();
    if (!Array.isArray(profiles) || !profiles.some((p) => p.profile === "NEXUS_ROOT" && p.active === true)) return reply({ message: "Acesso ROOT necessário." }, 403);
    const [connectionsResponse, organizationsResponse] = await Promise.all([
      fetch(`${base}/rest/v1/nexus_meta_whatsapp_connections?select=id,organization_id,waba_id,phone_number_id,display_phone_number,connection_status,connected_at,created_at,updated_at&order=created_at.desc`, { headers: adminHeaders, cache: "no-store" }),
      fetch(`${base}/rest/v1/nexus_organizations?select=id,name`, { headers: adminHeaders, cache: "no-store" }),
    ]);
    if (!connectionsResponse.ok || !organizationsResponse.ok) return reply({ message: "Falha ao consultar conexões." }, 503);
    const connections = await connectionsResponse.json();
    const organizations = await organizationsResponse.json();
    if (!Array.isArray(connections) || !Array.isArray(organizations)) return reply({ message: "Resposta inválida do banco." }, 503);
    const names = new Map(organizations.map((org) => [org.id, org.name]));
    return reply({ connections: connections.map((c) => ({
      id: c.id, organization_id: c.organization_id, organization_name: names.get(c.organization_id) || "Organização não encontrada",
      waba_id: c.waba_id, phone_number_id: c.phone_number_id,
      display_phone_number: c.display_phone_number, connection_status: c.connection_status,
      connected_at: c.connected_at, created_at: c.created_at, updated_at: c.updated_at,
    })) });
  } catch {
    return reply({ message: "Não foi possível carregar as conexões." }, 500);
  }
}
