import { NextResponse } from "next/server";

const ADMIN_PROFILES = new Set(["NEXUS_ROOT", "NEXUS_ADMIN"]);

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("nexus_access_token")?.value;
  const profile = request.cookies.get("nexus_profile")?.value;

  if (!token || !profile) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && !ADMIN_PROFILES.has(profile)) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
