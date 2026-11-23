export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const officialPhoneId = "1453993444467017";
const officialOrgId = "7ca2ee92-6b12-4f54-ba7b-986bab2f9434";

export async function GET(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !anon || !service) return reply({ message: "Serviço não configurado." }, 503);
  const token = request.cookies.get("nexus_access_token")?.value;
  if (!token) return reply({ message: "Faça login no NEXUS." }, 401);
  try {
    const identity = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!identity.ok) return reply({ message: "Sessão inválida." }, 401);
    const user = await identity.json();
    if (!user?.id) return reply({ message: "Sessão inválida." }, 401);
    const headers = { apikey: service, Authorization: `Bearer ${service}` };
    const membership = await fetch(`${base}/rest/v1/nexus_user_profiles?select=profile,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true`, { headers, cache: "no-store" });
    if (!membership.ok) return reply({ message: "Não foi possível validar permissões." }, 503);
    const profiles = await membership.json();
    if (!Array.isArray(profiles) || !profiles.some((p) => p.profile === "NEXUS_ROOT" && p.active === true)) {
      return reply({ message: "Acesso ROOT necessário." }, 403);
    }
    const params = new URLSearchParams({
      select: "event_hash,event_payload,processing_status,phone_number_id,organization_id",
      organization_id: `eq.${officialOrgId}`,
      phone_number_id: `eq.${officialPhoneId}`,
      limit: "100",
    });
    const eventsResponse = await fetch(`${base}/rest/v1/nexus_whatsapp_webhook_events?${params}`, { headers, cache: "no-store" });
    if (!eventsResponse.ok) {
      console.error("chatbot_conversations_query_failed", eventsResponse.status);
      return reply({ message: "Não foi possível consultar os eventos do WhatsApp." }, 503);
    }
    const rows = await eventsResponse.json();
    if (!Array.isArray(rows)) return reply({ message: "Resposta inválida do armazenamento." }, 503);
    const messages = [];
    for (const row of rows) {
      const entries = row.event_payload?.entry;
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (String(entry?.id || "") !== "1494371125908048") continue;
        for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
          if (change?.field !== "messages" && change?.field !== "smb_message_echoes") continue;
          const value = change.value || {};
          const contacts = Array.isArray(value.contacts) ? value.contacts : [];
          for (const msg of Array.isArray(value.messages) ? value.messages : []) {
            const contact = contacts.find((c) => c.wa_id === msg.from);
            const type = String(msg.type || "desconhecido");
            const body = type === "text" ? String(msg.text?.body || "") :
              type === "button" ? String(msg.button?.text || "") :
              type === "interactive" ? String(msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "[interativo]") :
              `[${type}]`;
            messages.push({
              id: String(msg.id || row.event_hash || ""),
              from: String(msg.from || ""),
              name: String(contact?.profile?.name || ""),
              timestamp: /^\d{9,13}$/.test(String(msg.timestamp || "")) ? Number(msg.timestamp) : null,
              body: body.slice(0, 4000), type,
              direction: change.field === "smb_message_echoes" ? "echo" : "incoming",
              processing_status: String(row.processing_status || ""),
            });
          }
        }
      }
    }
    messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return reply({ messages: messages.slice(0, 100), event_count: rows.length, sending_enabled: false });
  } catch (error) {
    console.error("chatbot_conversations_unexpected_error", error?.name || "unknown");
    return reply({ message: "Falha temporária na consulta de conversas." }, 503);
  }
}
