import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function requireAuthenticatedUser(allowedProfiles) {
  const store = await cookies();
  const token = store.get("nexus_access_token")?.value;
  const profile = store.get("nexus_profile")?.value;
  const organizationId = store.get("nexus_organization")?.value;

  if (!token || !profile || !URL || !KEY) redirect("/login");

  const response = await fetch(`${URL}/auth/v1/user`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) redirect("/login");
  if (allowedProfiles && !allowedProfiles.includes(profile)) redirect("/acesso-negado");

  return {
    user: await response.json(),
    profile,
    organizationId: organizationId || null,
  };
}
