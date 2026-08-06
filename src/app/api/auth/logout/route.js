import { NextResponse } from "next/server";

const AUTH_COOKIE = "nexus_session";
const PROFILE_COOKIE = "nexus_profile";
const ORG_COOKIE = "nexus_organization";

export async function POST(request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);

  for (const cookieName of [AUTH_COOKIE, PROFILE_COOKIE, ORG_COOKIE]) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
