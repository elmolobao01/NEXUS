import { NextResponse } from "next/server";

export async function POST(request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);

  for (const name of [
    "nexus_access_token",
    "nexus_refresh_token",
    "nexus_profile",
    "nexus_organization",
  ]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
