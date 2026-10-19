import { NextResponse } from "next/server";
import { portalBase, sendPleniumEmail } from "../../../../lib/email/resend";

export async function POST(request) {
  const generic = () => NextResponse.json({ message: "Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha." });
  try {
    const { email } = await request.json();
    const address = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return NextResponse.json({ message: "Informe um e-mail válido." }, { status: 400 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service || !process.env.RESEND_API_KEY) return NextResponse.json({ message: "Recuperação temporariamente indisponível." }, { status: 503 });
    const result = await fetch(`${url}/auth/v1/admin/generate_link?redirect_to=${encodeURIComponent(`${portalBase()}/definir-senha`)}`, {
      method: "POST", headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "recovery", email: address }), cache: "no-store",
    });
    const data = await result.json().catch(() => ({}));
    if (result.ok && data?.action_link) {
      await sendPleniumEmail({to:address,subject:"PLENIUM | Recuperação de senha",heading:"Redefina sua senha",message:"Recebemos uma solicitação de recuperação de senha. Utilize o link abaixo para definir uma nova senha. Se não foi você, ignore esta mensagem.",link:data.action_link,button:"Redefinir minha senha"});
    }
    return generic();
  } catch { return generic(); }
}
