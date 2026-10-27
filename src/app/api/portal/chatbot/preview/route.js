import { NextResponse } from "next/server";
import { basicReply } from "../basic-engine";

export const dynamic = "force-dynamic";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export async function POST(request) {
  try {
    const token = request.cookies.get("nexus_access_token")?.value;
    if (!URL || !KEY || !token) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
    const headers = { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const auth = await fetch(`${URL}/auth/v1/user`, { headers, cache: "no-store" });
    if (!auth.ok) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
    const user = await auth.json();
    const p = await fetch(`${URL}/rest/v1/nexus_user_profiles?select=organization_id,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`, { headers, cache: "no-store" });
    if (!p.ok) return NextResponse.json({ message: "Perfil indisponível." }, { status: 503 });
    const org = (await p.json())?.[0]?.organization_id;
    if (!org) return NextResponse.json({ message: "Organização não encontrada." }, { status: 403 });
    const e = await fetch(`${URL}/rest/v1/rpc/nexus_chatbot_entitlement`, { method: "POST", headers, body: JSON.stringify({ p_organization_id: org }), cache: "no-store" });
    if (!e.ok) return NextResponse.json({ message: "Não foi possível validar o contrato." }, { status: 503 });
    const plan = await e.json();
    if (!["CHATBOT_BASIC", "CHATBOT_AI"].includes(plan)) return NextResponse.json({ message: "Chatbot não contratado." }, { status: 403 });
    const c = await fetch(`${URL}/rest/v1/nexus_chatbot_configs?organization_id=eq.${encodeURIComponent(org)}&select=active,welcome_message,closing_message,faq&limit=1`, { headers, cache: "no-store" });
    if (!c.ok) return NextResponse.json({ message: "Configuração indisponível." }, { status: 503 });
    const body = await request.json();
    if (typeof body.message !== "string" || body.message.length > 1000) return NextResponse.json({ message: "Mensagem inválida (máximo de 1.000 caracteres)." }, { status: 400 });
    const result = basicReply((await c.json())?.[0], body.message);
    return NextResponse.json({ ...result, plan, ai_used: false, preview: true,
      matched_faq: result.type === "faq", requires_human_review: result.type === "fallback",
      human_handoff_executed: false, sending_enabled: false, credits_debited: false });
  } catch { return NextResponse.json({ message: "Falha ao testar chatbot." }, { status: 500 }); }
}
