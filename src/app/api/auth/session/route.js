import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const unauthorized = () => NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });

export async function GET(request) {
  try {
    const token = request.cookies.get("nexus_access_token")?.value;
    if (!token || !URL || !KEY) return unauthorized();

    const headers = { apikey: KEY, Authorization: `Bearer ${token}` };
    const auth = await fetch(`${URL}/auth/v1/user`, { headers, cache: "no-store" });
    if (!auth.ok) return unauthorized();
    const user = await auth.json();
    if (!user?.id) return unauthorized();

    // O perfil deve vir do banco, não de um cookie opcional ou editável.
    const profiles = await fetch(
      `${URL}/rest/v1/nexus_user_profiles?select=profile,organization_id,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`,
      { headers, cache: "no-store" }
    );
    if (!profiles.ok) return NextResponse.json({ authenticated: false, message: "Não foi possível verificar o perfil." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const profile = (await profiles.json())?.[0];
    if (!profile?.profile || !profile?.organization_id) return unauthorized();

    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email },
      profile: profile.profile,
      organizationId: profile.organization_id,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ authenticated: false, message: "Falha ao consultar a sessão." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
