import { createHmac, timingSafeEqual } from 'node:crypto';
export const PLATFORM = '7ca2ee92-6b12-4f54-ba7b-986bab2f9434';
export const OPERATION = '11de735a-4dfb-4b8d-b817-bda83d6df03a';
export const COOKIE = 'plenium_master_context';
export function signature(token, userId, org, secret) {
  return createHmac('sha256', secret).update(JSON.stringify([token,userId,org])).digest('hex');
}
export function selected(store, token, userId, secret) {
  const value = store.get(COOKIE)?.value || '';
  const expected = signature(token,userId,OPERATION,secret);
  return /^[a-f0-9]{64}$/.test(value) && timingSafeEqual(Buffer.from(value),Buffer.from(expected)) ? OPERATION : PLATFORM;
}
export async function master(store) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = store.get('nexus_access_token')?.value;
  if (!base || !pub || !service || !token) return null;
  const auth = await fetch(`${base}/auth/v1/user`, {headers:{apikey:pub,Authorization:`Bearer ${token}`},cache:'no-store'});
  if (!auth.ok) return null;
  const user = await auth.json();
  if (!user?.id) return null;
  const headers = {apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'};
  const p = await fetch(`${base}/rest/v1/nexus_user_profiles?select=profile,active,organization_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,{headers,cache:'no-store'});
  if (!p.ok) return null;
  const profile = (await p.json())?.[0];
  if (profile?.profile !== 'NEXUS_ROOT' || profile.active !== true || profile.organization_id !== PLATFORM) return null;
  const o = await fetch(`${base}/rest/v1/nexus_organizations?select=id,status,slug&id=eq.${OPERATION}&limit=1`,{headers,cache:'no-store'});
  if (!o.ok) return null;
  const org = (await o.json())?.[0];
  if (org?.status !== 'active' || org.slug !== 'plenium') return null;
  return {base,headers,user,token,service,organizationId:selected(store,token,user.id,service)};
}
export function sameOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
