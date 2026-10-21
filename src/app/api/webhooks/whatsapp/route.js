import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response = (body, status) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const safeEqual = (a, b) => {
  const x = Buffer.from(a || "");
  const y = Buffer.from(b || "");
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!expected || params.get("hub.mode") !== "subscribe" || !safeEqual(params.get("hub.verify_token"), expected) || !params.get("hub.challenge")) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(params.get("hub.challenge"), { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const secret = process.env.META_APP_SECRET;
  const signature = request.headers.get("x-hub-signature-256");
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature || "")) return response({ error: "Unauthorized" }, 401);
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > 1024 * 1024) return response({ error: "Payload too large" }, 413);
  const digest = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  if (!safeEqual(signature, digest)) return response({ error: "Unauthorized" }, 401);

  let payload;
  try { payload = JSON.parse(raw.toString("utf8")); } catch { return response({ error: "Invalid JSON" }, 400); }
  if (payload?.object !== "whatsapp_business_account" || !Array.isArray(payload.entry) || payload.entry.length === 0) {
    return response({ error: "Unexpected event" }, 400);
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return response({ error: "Storage unavailable" }, 503);
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  try {
    const events = [];
    for (const entry of payload.entry) {
      if (!Array.isArray(entry?.changes) || !entry.changes.length) return response({ error: "Unrecognized changes" }, 422);
      for (const change of entry.changes) {
        const phoneId = change?.value?.metadata?.phone_number_id;
        if (change?.field !== "messages" || typeof phoneId !== "string" || !/^\d{5,30}$/.test(phoneId)) {
          // Never acknowledge unhandled event shapes as successfully stored.
          return response({ error: "Unsupported event shape" }, 422);
        }
        events.push({ entry, change, phoneId });
      }
    }
    // Resolve tenant on the server; never trust organization information from the payload.
    const ids = [...new Set(events.map((event) => event.phoneId))];
    const owners = new Map();
    for (const phoneId of ids) {
      const lookup = await fetch(`${base}/rest/v1/nexus_meta_whatsapp_connections?select=organization_id,phone_number_id&phone_number_id=eq.${encodeURIComponent(phoneId)}&limit=2`, { headers, cache: "no-store" });
      if (!lookup.ok) { console.error("whatsapp_owner_lookup_failed", lookup.status); return response({ error: "Tenant lookup failed" }, 503); }
      const rows = await lookup.json();
      if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]?.organization_id) {
        console.error("whatsapp_owner_not_resolved", { count: Array.isArray(rows) ? rows.length : -1 });
        return response({ error: "Tenant not linked" }, 503);
      }
      owners.set(phoneId, rows[0].organization_id);
    }
    // Each change is independently deduplicated, even if Meta retries a batch.
    const records = events.map(({ entry, change, phoneId }) => ({
      organization_id: owners.get(phoneId),
      phone_number_id: phoneId,
      waba_id: String(entry.id || ""),
      event_hash: createHash("sha256").update(JSON.stringify({ entry_id: entry.id, change })).digest("hex"),
      event_payload: { object: payload.object, entry: [{ id: entry.id, changes: [change] }] },
      processing_status: "received",
    }));
    const stored = await fetch(`${base}/rest/v1/nexus_whatsapp_webhook_events?on_conflict=event_hash`, {
      method: "POST", cache: "no-store",
      headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(records),
    });
    if (!stored.ok) {
      console.error("whatsapp_event_persist_failed", { status: stored.status });
      return response({ error: "Event persistence failed" }, 503);
    }
    return response({ received: true }, 200);
  } catch {
    console.error("whatsapp_webhook_unexpected_error");
    return response({ error: "Temporary processing failure" }, 503);
  }
}
