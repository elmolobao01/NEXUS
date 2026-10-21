import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function equalSecret(a, b) {
  const left = Buffer.from(a || "");
  const right = Buffer.from(b || "");
  return left.length === right.length && timingSafeEqual(left, right);
}

// Meta verification handshake. The verification token must be a private server-side env var.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (!expected || mode !== "subscribe" || !token || !equalSecret(token, expected) || !challenge) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

// Receive only authentic Meta events. Do not acknowledge delivery until a durable
// queue/processing pipeline is configured; otherwise messages could be silently lost.
export async function POST(request) {
  const secret = process.env.META_APP_SECRET;
  const signature = request.headers.get("x-hub-signature-256");
  if (!secret || !signature?.startsWith("sha256=")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const raw = Buffer.from(await request.arrayBuffer());
  const digest = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  if (!equalSecret(signature, digest)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Retryable response until event persistence, deduplication, and tenant routing exist.
  return NextResponse.json({ error: "Webhook processing not configured" }, { status: 503 });
}
