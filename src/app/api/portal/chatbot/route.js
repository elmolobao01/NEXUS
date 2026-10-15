import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const response = (message, status) => NextResponse.json({ message }, { status });
async function authorize(request) {
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!URL || !KEY || !token) return null;
  const headers = { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const auth = await fetch(`${URL}/auth/v1/user`, { headers, cache: "no-store" });
  if (!auth.ok) return null;
  const user = await auth.json();
  if (!user?.id) return null;
  const r = await fetch(`${URL}/rest/v1/nexus_user_profiles?select=organization_id,profile,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`, { headers, cache: "no-store" });
  if (!r.ok) return null;
  const profile = (await r.json())?.[0];
  if (!profile?.organization_id) return null;
  return { headers, profile };
}
export async function GET(request) {
  try {
    const ctx = await authorize(request);
    if (!ctx) return response("Acesso não autorizado.", 401);
    const org = encodeURIComponent(ctx.profile.organization_id);
    const r = await fetch(`${URL}/rest/v1/nexus_chatbot_configs?organization_id=eq.${org}&select=*&limit=1`, { headers: ctx.headers, cache: "no-store" });
    if (!r.ok) return response("Não foi possível consultar a configuração. Verifique a migração do banco.", 502);
    return NextResponse.json({ config: (await r.json())?.[0] || null });
  } catch { return response("Falha ao consultar chatbot.", 500); }
}
export async function PUT(request) {
  try {
    const ctx = await authorize(request);
    if (!ctx) return response("Acesso não autorizado.", 401);
    if (!["NEXUS_ROOT","NEXUS_ADMIN","CLIENT_ADMIN"].includes(ctx.profile.profile)) return response("Perfil sem permissão de edição.", 403);
    const body = await request.json();
    const clean = (value, max) => String(value ?? "").trim().slice(0, max);
    const tone = ["acolhedor","profissional","descontraido"].includes(body.tone) ? body.tone : "acolhedor";
    const faq = Array.isArray(body.faq) ? body.faq.slice(0, 50).map(x => ({ question: clean(x.question, 250), answer: clean(x.answer, 1500) })).filter(x => x.question && x.answer) : [];
    const payload = { organization_id: ctx.profile.organization_id, assistant_name: clean(body.assistant_name, 120) || "Assistente PLENIUM", welcome_message: clean(body.welcome_message, 1500) || "Olá! Como posso ajudar?", closing_message: clean(body.closing_message, 1500), instructions: clean(body.instructions, 8000), tone, faq, active: body.active === true, updated_at: new Date().toISOString() };
    const r = await fetch(`${URL}/rest/v1/nexus_chatbot_configs?on_conflict=organization_id`, { method: "POST", headers: { ...ctx.headers, Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(payload), cache: "no-store" });
    if (!r.ok) return response("Não foi possível salvar a configuração. Verifique permissões e migração.", 502);
    return NextResponse.json({ ok: true, config: (await r.json())?.[0] });
  } catch { return response("Falha ao salvar chatbot.", 500); }
}
