import { createHash, timingSafeEqual } from "node:crypto";
import { basicReply } from "../../portal/chatbot/basic-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROOT_ORGANIZATION_ID = "7ca2ee92-6b12-4f54-ba7b-986bab2f9434";
const reply = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

// Dedicated, non-persistent homologation preview. Never sends to Meta,
// changes event status, reserves/debits wallets or uses customer contracts.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") || "";
  const expected = secret ? `Bearer ${secret}` : "";
  const valid = expected && Buffer.byteLength(supplied) === Buffer.byteLength(expected)
    && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) return reply({ error: "Unauthorized" }, 401);

  const phoneId = process.env.CHATBOT_HOMOLOGATION_PHONE_NUMBER_ID;
  const organizationId = process.env.CHATBOT_HOMOLOGATION_ORGANIZATION_ID;
  if (!phoneId || !/^\d{5,30}$/.test(phoneId) || organizationId !== ROOT_ORGANIZATION_ID) {
    return reply({ error: "Homologation allowlist not configured" }, 503);
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return reply({ error: "Service unavailable" }, 503);
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const get = async (path) => {
    const res = await fetch(`${base}/rest/v1/${path}`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`read_failed_${res.status}`);
    return res.json();
  };

  try {
    const [connections, events] = await Promise.all([
      get(`nexus_meta_whatsapp_connections?select=phone_number_id,organization_id,connection_status&organization_id=eq.${organizationId}&phone_number_id=eq.${phoneId}&limit=2`),
      get(`nexus_whatsapp_webhook_events?select=id,organization_id,phone_number_id,event_payload&processing_status=eq.received&organization_id=eq.${organizationId}&phone_number_id=eq.${phoneId}&order=received_at.asc&limit=50`),
    ]);
    if (!Array.isArray(connections) || connections.length !== 1 || connections[0].connection_status !== "active") {
      return reply({ error: "Homologation connection not active" }, 409);
    }
    if (!Array.isArray(events)) throw new Error("invalid_events");

    // Explicitly synthetic configuration; never read or modify a customer's
    // chatbot configuration, plan, wallet or entitlement.
    const syntheticConfig = {
      active: true,
      welcome_message: "Olá! Este é o ambiente de homologação da PLENIUM.",
      closing_message: "Obrigado! Esta conversa foi apenas uma simulação.",
      faq: [],
    };
    const seen = new Set();
    const records = [];
    for (const event of events) {
      const changes = Array.isArray(event.event_payload?.entry)
        ? event.event_payload.entry.flatMap(e => Array.isArray(e?.changes) ? e.changes : []) : [];
      const messages = changes.flatMap(c => Array.isArray(c?.value?.messages) ? c.value.messages : []);
      if (!messages.length) {
        records.push({ event_id: event.id, status: "ignored", reason: "no_incoming_messages" });
        continue;
      }
      for (const message of messages.slice(0, 20)) {
        if (typeof message?.id !== "string" || !message.id.trim()) {
          records.push({ event_id: event.id, status: "ignored", reason: "missing_message_id" });
          continue;
        }
        const fingerprint = createHash("sha256").update(message.id).digest("hex").slice(0, 16);
        if (seen.has(message.id)) {
          records.push({ event_id: event.id, message_fingerprint: fingerprint, status: "ignored", reason: "duplicate_in_batch" });
          continue;
        }
        seen.add(message.id);
        if (message.type !== "text" || typeof message.text?.body !== "string" || !message.text.body.trim()) {
          records.push({ event_id: event.id, message_fingerprint: fingerprint, status: "ignored", reason: "unsupported_message_type" });
          continue;
        }
        const result = basicReply(syntheticConfig, message.text.body);
        records.push({
          event_id: event.id,
          message_fingerprint: fingerprint,
          status: result?.reply?.trim() ? "simulated" : "ignored",
          reason: result?.reply?.trim() ? "synthetic_basic_reply" : "empty_reply",
          response_type: result?.type || null,
          // No inbound or outbound text exposed to the cron caller.
          response_length: typeof result?.reply === "string" ? result.reply.length : 0,
        });
      }
    }
    const reason_counts = records.reduce((acc, record) => ({ ...acc, [record.reason]: (acc[record.reason] || 0) + 1 }), {});
    return reply({
      mode: "homologation_preview", scope: "root_phone_only", persistence: "none",
      sending_enabled: false, database_modified: false, credits_debited: false,
      contracts_consulted: false, wallets_consulted: false,
      events_scanned: events.length, reason_counts, records,
    });
  } catch (error) {
    console.error("homologation_preview_failed", error?.message || "unknown");
    return reply({ error: "Homologation preview unavailable" }, 503);
  }
}
