import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function requireAuthenticatedUser(allowedProfiles) {
  const store = await cookies();
  const token = store.get("nexus_access_token")?.value;

  if (!token || !URL || !KEY) redirect("/login");

  const response = await fetch(`${URL}/auth/v1/user`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) redirect("/login");
  const user = await response.json();
  if (!user?.id) redirect("/login");
  const membership = await fetch(`${URL}/rest/v1/nexus_user_profiles?select=profile,organization_id,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`, {headers:{apikey:KEY,Authorization:`Bearer ${token}`},cache:"no-store"});
  if (!membership.ok) redirect("/acesso-negado");
  const row = (await membership.json())?.[0];
  if (!row?.profile || !row.organization_id) redirect("/acesso-negado");
  const {profile, organization_id: organizationId} = row;
  if (allowedProfiles && !allowedProfiles.includes(profile)) redirect("/acesso-negado");

  return {
    user,
    profile,
    organizationId: organizationId || null,
  };
}
