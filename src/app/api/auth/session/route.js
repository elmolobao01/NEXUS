import { NextResponse } from "next/server";

const AUTH_COOKIE = "nexus_session";
const PROFILE_COOKIE = "nexus_profile";
const ORG_COOKIE = "nexus_organization";

export async function GET(request) {
  const session = request.cookies.get(AUTH_COOKIE)?.value;
  const profile = request.cookies.get(PROFILE_COOKIE)?.value;
  const organizationId = request.cookies.get(ORG_COOKIE)?.value;

  if (!session || !profile) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    profile,
    organizationId: organizationId || null,
  });
}
