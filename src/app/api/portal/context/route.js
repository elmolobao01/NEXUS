import { NextResponse } from "next/server";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const headers = (token) => ({ apikey: KEY, Authorization: `Bearer ${token}` });

export async function GET(request) {
  const token = request.cookies.get("nexus_access_token")?.value;
  const organizationId = request.cookies.get("nexus_organization")?.value;
  if (!URL || !KEY || !token || !organizationId) return NextResponse.json({ message: "Contexto organizacional indisponível." }, { status: 401 });

  const [orgRes, unitsRes] = await Promise.all([
    fetch(`${URL}/rest/v1/nexus_organizations?id=eq.${encodeURIComponent(organizationId)}&select=id,name,legal_name,slug,segment,status,logo_url,email,phone,settings&limit=1`, { headers: headers(token), cache: "no-store" }),
    fetch(`${URL}/rest/v1/nexus_organization_units?organization_id=eq.${encodeURIComponent(organizationId)}&active=eq.true&select=id,name,code,is_main&order=is_main.desc,name.asc`, { headers: headers(token), cache: "no-store" }),
  ]);
  if (!orgRes.ok) return NextResponse.json({ message: "Organização não autorizada." }, { status: 403 });
  const organizations = await orgRes.json();
  const organization = organizations?.[0];
  if (!organization) return NextResponse.json({ message: "Organização não encontrada." }, { status: 404 });
  const units = unitsRes.ok ? await unitsRes.json() : [];
  return NextResponse.json({ ok: true, organization, units });
}
