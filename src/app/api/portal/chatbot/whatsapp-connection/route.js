export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

// Read-only, tenant-scoped view. Never returns OAuth tokens or credential payloads.
export async function GET(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !anon || !service) return reply({ message: "Integração não configurada." }, 503);
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!token) return reply({ message: "Faça login no Portal." }, 401);
  const userHeaders = { apikey: anon, Authorization: `Bearer ${token}` };
  const adminHeaders = { apikey: service, Authorization: `Bearer ${service}` };
  try {
    const identity = await fetch(`${base}/auth/v1/user`, { headers: userHeaders, cache: "no-store" });
    if (!identity.ok) return reply({ message: "Sessão inválida." }, 401);
    const user = await identity.json();
    if (!user?.id) return reply({ message: "Sessão inválida." }, 401);
    const membershipsResponse = await fetch(`${base}/rest/v1/nexus_user_profiles?select=organization_id,profile,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true`, { headers: adminHeaders, cache: "no-store" });
    if (!membershipsResponse.ok) return reply({ message: "Falha ao verificar organização." }, 503);
    const memberships = await membershipsResponse.json();
    const allowed = Array.isArray(memberships) ? memberships.filter(p => p.active === true && p.organization_id && ["MANAGER", "CLIENT_ADMIN", "NEXUS_ROOT"].includes(p.profile)) : [];
    const organizations = [...new Set(allowed.map(p => p.organization_id))];
    if (!organizations.length) return reply({ message: "Acesso não autorizado." }, 403);
    if (organizations.length !== 1) return reply({ message: "Múltiplas organizações: seleção explícita necessária antes de consultar a conexão." }, 409);
    const organizationId = organizations[0];
    const orgResponse = await fetch(`${base}/rest/v1/nexus_organizations?select=id,status&id=eq.${encodeURIComponent(organizationId)}&limit=1`, { headers: adminHeaders, cache: "no-store" });
    if (!orgResponse.ok) return reply({ message: "Falha ao validar organização." }, 503);
    const org = (await orgResponse.json())?.[0];
    if (!org || org.status !== "active") return reply({ message: "Organização inativa ou inexistente." }, 403);
    const connectionResponse = await fetch(`${base}/rest/v1/nexus_meta_whatsapp_connections?select=display_phone_number,connection_status,connected_at,updated_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=10`, { headers: adminHeaders, cache: "no-store" });
    if (!connectionResponse.ok) return reply({ message: "Não foi possível consultar conexões." }, 503);
    const connections = await connectionResponse.json();
    if (!Array.isArray(connections)) return reply({ message: "Resposta inválida." }, 503);
    return reply({ connections, authorization_mode: process.env.META_OAUTH_CONTROLLED_TEST_ENABLED === "true" ? "controlled_test" : "disabled", sending_enabled: false });
  } catch { return reply({ message: "Falha ao consultar conexão." }, 500); }
}
