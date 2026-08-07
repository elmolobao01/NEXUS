import { NextResponse } from "next/server";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function GET(request) {
  const token = request.cookies.get("nexus_access_token")?.value;
  const profile = request.cookies.get("nexus_profile")?.value;
  const organizationId = request.cookies.get("nexus_organization")?.value;

  if (!token || !profile || !URL || !KEY) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const response = await fetch(`${URL}/auth/v1/user`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = await response.json();
  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, email: user.email },
    profile,
    organizationId: organizationId || null,
  });
}
