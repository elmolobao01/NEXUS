import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  ORG_COOKIE,
  PROFILE_COOKIE,
  getCookieMaxAge,
  getRedirectForProfile,
} from "../../../../lib/auth/config";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isDemoEnabled() {
  return process.env.NEXUS_DEMO_AUTH === "true";
}

function getDemoIdentity(email) {
  if (
    email.includes("root") ||
    email.includes("elmolobao") ||
    email.endsWith("@nexus.com.br")
  ) {
    return {
      accessToken: `demo-root-${Date.now()}`,
      refreshToken: "",
      profile: "NEXUS_ROOT",
      organizationId: "nexus-platform",
      userId: "demo-root",
    };
  }

  if (email.includes("admin")) {
    return {
      accessToken: `demo-admin-${Date.now()}`,
      refreshToken: "",
      profile: "CLIENT_ADMIN",
      organizationId: "org-demo",
      userId: "demo-admin",
    };
  }

  return {
    accessToken: `demo-user-${Date.now()}`,
    refreshToken: "",
    profile: "OPERATOR",
    organizationId: "org-demo",
    userId: "demo-user",
  };
}

async function authenticateWithSupabase(email, password) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const authResponse = await fetch(
    `${url}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    }
  );

  const authData = await authResponse.json();

  if (!authResponse.ok || !authData.access_token) {
    throw new Error(authData?.error_description || authData?.msg || "INVALID_CREDENTIALS");
  }

  const profileResponse = await fetch(
    `${url}/rest/v1/nexus_user_profiles?user_id=eq.${authData.user.id}&select=user_id,profile,organization_id,active&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${authData.access_token}`,
      },
      cache: "no-store",
    }
  );

  const profiles = await profileResponse.json();
  const profile = Array.isArray(profiles) ? profiles[0] : null;

  if (!profileResponse.ok || !profile?.active) {
    throw new Error("PROFILE_NOT_AUTHORIZED");
  }

  return {
    accessToken: authData.access_token,
    refreshToken: authData.refresh_token || "",
    profile: profile.profile,
    organizationId: profile.organization_id || "",
    userId: authData.user.id,
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const password = String(body.senha || "");
    const remember = Boolean(body.manterConectado);

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { message: "Informe um e-mail válido." },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { message: "A senha deve possuir pelo menos 4 caracteres." },
        { status: 400 }
      );
    }

    let identity;

    if (isDemoEnabled()) {
      identity = getDemoIdentity(email);
    } else {
      identity = await authenticateWithSupabase(email, password);
    }

    const response = NextResponse.json({
      ok: true,
      profile: identity.profile,
      redirectTo: getRedirectForProfile(identity.profile),
    });

    const maxAge = getCookieMaxAge(remember);
    const secure = process.env.NODE_ENV === "production";

    response.cookies.set(AUTH_COOKIE, identity.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    response.cookies.set(PROFILE_COOKIE, identity.profile, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    response.cookies.set(ORG_COOKIE, identity.organizationId || "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AUTHENTICATION_FAILED";

    if (message === "SUPABASE_NOT_CONFIGURED") {
      return NextResponse.json(
        {
          message:
            "Autenticação ainda não configurada. Cadastre as variáveis do Supabase ou habilite NEXUS_DEMO_AUTH=true.",
        },
        { status: 503 }
      );
    }

    if (message === "PROFILE_NOT_AUTHORIZED") {
      return NextResponse.json(
        { message: "Usuário sem perfil ativo no NEXUS." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { message: "E-mail ou senha inválidos." },
      { status: 401 }
    );
  }
}
