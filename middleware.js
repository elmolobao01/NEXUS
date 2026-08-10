import { NextResponse } from "next/server";

const ADMIN_PROFILES = new Set(["NEXUS_ROOT", "NEXUS_ADMIN"]);
const CLIENT_PROFILES = new Set(["CLIENT_ADMIN", "MANAGER", "SUPERVISOR", "OPERATOR", "VIEWER"]);

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("nexus_access_token")?.value;
  const profile = request.cookies.get("nexus_profile")?.value;

  if (!token || !profile) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Roteamento contextual: se um usuário autenticado tentar abrir o ambiente
  // errado, o NEXUS o conduz automaticamente ao ambiente correspondente.
  if (pathname.startsWith("/admin") && CLIENT_PROFILES.has(profile)) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  if (pathname.startsWith("/admin") && !ADMIN_PROFILES.has(profile)) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  if (pathname.startsWith("/portal") && !CLIENT_PROFILES.has(profile) && !ADMIN_PROFILES.has(profile)) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
