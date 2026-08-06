import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  PROFILE_COOKIE,
} from "./src/lib/auth/config";

const ADMIN_PROFILES = new Set(["NEXUS_ROOT", "NEXUS_ADMIN"]);

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(AUTH_COOKIE)?.value;
  const profile = request.cookies.get(PROFILE_COOKIE)?.value;

  if (!session || !profile) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && !ADMIN_PROFILES.has(profile)) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
