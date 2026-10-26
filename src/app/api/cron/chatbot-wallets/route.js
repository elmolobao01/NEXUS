export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !service) {
    return Response.json({ error: "Service unavailable" }, { status: 503 });
  }
  try {
    const response = await fetch(`${base}/rest/v1/rpc/nexus_sync_chatbot_wallets`, {
      method: "POST",
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });
    if (!response.ok) {
      return Response.json({ error: "Wallet synchronization failed" }, { status: 503 });
    }
    const result = await response.json();
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Wallet synchronization unavailable" }, { status: 503 });
  }
}
