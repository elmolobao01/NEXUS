import { NextResponse } from "next/server";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ROUTES = {
  NEXUS_ROOT: "/admin",
  NEXUS_ADMIN: "/admin",
  CLIENT_ADMIN: "/portal",
  MANAGER: "/portal",
  SUPERVISOR: "/portal",
  OPERATOR: "/portal",
  VIEWER: "/portal",
};

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export async function POST(request) {
  try {
    if (!URL || !KEY) {
      return NextResponse.json(
        { message: "As variáveis do Supabase não estão configuradas." },
        { status: 503 }
      );
    }

    const { email, senha, manterConectado } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const password = String(senha || "");

    if (!normalizedEmail.includes("@")) {
      return NextResponse.json({ message: "Informe um e-mail válido." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "A senha deve possuir pelo menos 6 caracteres." },
        { status: 400 }
      );
    }

    const authResponse = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizedEmail, password }),
      cache: "no-store",
    });

    const authData = await authResponse.json();

    if (!authResponse.ok || !authData?.access_token || !authData?.user?.id) {
      return NextResponse.json(
        { message: "E-mail ou senha inválidos." },
        { status: 401 }
      );
    }

    const profileResponse = await fetch(
      `${URL}/rest/v1/nexus_user_profiles?user_id=eq.${authData.user.id}&select=profile,organization_id,active&limit=1`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${authData.access_token}`,
        },
        cache: "no-store",
      }
    );

    const rows = await profileResponse.json();
    const profile = Array.isArray(rows) ? rows[0] : null;

    if (!profileResponse.ok || !profile) {
      return NextResponse.json(
        { message: "Usuário autenticado, mas sem perfil no NEXUS." },
        { status: 403 }
      );
    }

    if (!profile.active) {
      return NextResponse.json({ message: "Este acesso está desativado." }, { status: 403 });
    }

    const maxAge = manterConectado ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
    const response = NextResponse.json({
      ok: true,
      redirectTo: ROUTES[profile.profile] || "/portal",
      profile: profile.profile,
    });

    response.cookies.set("nexus_access_token", authData.access_token, cookieOptions(maxAge));
    response.cookies.set("nexus_refresh_token", authData.refresh_token || "", cookieOptions(60 * 60 * 24 * 30));
    response.cookies.set("nexus_profile", profile.profile, cookieOptions(maxAge));
    response.cookies.set("nexus_organization", profile.organization_id || "", cookieOptions(maxAge));

    return response;
  } catch {
    return NextResponse.json(
      { message: "Falha inesperada durante a autenticação." },
      { status: 500 }
    );
  }
}
