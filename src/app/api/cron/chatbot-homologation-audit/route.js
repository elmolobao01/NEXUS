import { createHash, timingSafeEqual } from "node:crypto";
import { basicReply } from "../../portal/chatbot/basic-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT_ID = "7ca2ee92-6b12-4f54-ba7b-986bab2f9434";
const PHONE_ID = "1295394797000036";
const json = (value, status = 200) => Response.json(value, {
  status, headers: { "Cache-Control": "no-store" },
});
const digest = (value) => createHash("sha256").update(value).digest("hex");

export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization") || "";
  const expected = secret ? `Bearer ${secret}` : "";
  if (!expected || Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (process.env.CHATBOT_HOMOLOGATION_AUDIT_ENABLED !== "true" ||
      process.env.CHATBOT_HOMOLOGATION_ORGANIZATION_ID !== ROOT_ID ||
      process.env.CHATBOT_HOMOLOGATION_PHONE_NUMBER_ID !== PHONE_ID) {
    return json({ error: "Audit disabled or allowlist invalid" }, 503);
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return json({ error: "Service unavailable" }, 503);
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const read = async (path) => {
    const r = await fetch(`${base}/rest/v1/${path}`, { headers, cache: "no-store" });
    if (!r.ok) throw new Error(`read_${r.status}`);
    return r.json();
  };
  try {
    const connections = await read(`nexus_meta_whatsapp_connections?select=id,connection_status&organization_id=eq.${ROOT_ID}&phone_number_id=eq.${PHONE_ID}&limit=2`);
    if (connections.length !== 1 || connections[0].connection_status !== "active") {
      return json({ error: "Homologation connection unavailable" }, 409);
    }
    const events = await read(`nexus_whatsapp_webhook_events?select=id,event_payload&organization_id=eq.${ROOT_ID}&phone_number_id=eq.${PHONE_ID}&processing_status=eq.received&order=received_at.asc&limit=50`);
    const config = {
      active: true, welcome_message: "Olá! Este é o ambiente de homologação da PLENIUM.",
      closing_message: "Obrigado! Esta conversa foi apenas uma simulação.", faq: [],
    };
    const rows = [];
    for (const event of events) {
      const entries = Array.isArray(event.event_payload?.entry) ? event.event_payload.entry : [];
      const messages = entries.flatMap(entry =>
        (Array.isArray(entry?.changes) ? entry.changes : []).flatMap(change =>
          Array.isArray(change?.value?.messages) ? change.value.messages : []));
      // Events without inbound messages (e.g. Meta status updates) are not persisted.
      for (const message of messages) {
        if (typeof message?.id !== "string" || !message.id.trim()) continue;
        const fingerprint = digest(message.id);
        let status = "ignored", reason = "unsupported_message_type";
        let responseType = null, responseLength = 0;
        if (message.type === "text" && typeof message.text?.body === "string" &&
            message.text.body.trim()) {
          const result = basicReply(config, message.text.body);
          responseType = result?.type || null;
          responseLength = typeof result?.reply === "string" ? result.reply.length : 0;
          status = result?.reply?.trim() ? "simulated" : "ignored";
          reason = status === "simulated" ? "synthetic_basic_reply" : "empty_reply";
        }
        rows.push({
          organization_id: ROOT_ID, phone_number_id: PHONE_ID, event_id: event.id,
          message_fingerprint: fingerprint, status, reason,
          response_type: responseType, response_length: responseLength,
        });
      }
    }
    // Idempotency is enforced by the database unique constraint across runs.
    // Duplicates are ignored; previous audit rows are never overwritten.
    if (rows.length) {
      const r = await fetch(`${base}/rest/v1/nexus_chatbot_homologation_audit?on_conflict=organization_id,phone_number_id,message_fingerprint`, {
        method: "POST",
        headers: {
          ...headers, "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify(rows),
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`audit_write_${r.status}`);
    }
    return json({
      mode: "homologation_audit", scope: "root_phone_only",
      sending_enabled: false, credits_debited: false,
      contracts_consulted: false, wallets_consulted: false,
      webhook_events_modified: false,
      events_scanned: events.length, candidates: rows.length,
      persistence: "audit_only", idempotency: "database_unique",
      note: "Candidates include previously audited messages; no message text is stored.",
    });
  } catch (error) {
    console.error("homologation_audit_failed", error?.message || "unknown");
    return json({ error: "Homologation audit unavailable; check server logs" }, 503);
  }
}
