import { NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function headers(token, extra = {}) { return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra }; }
function getToken(request) { return request.cookies.get("nexus_access_token")?.value || ""; }
async function requireRoot(request) {
  const token = getToken(request);
  if (!token || !SUPABASE_URL || !SUPABASE_KEY) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/nexus_user_profiles?select=user_id,profile,active&limit=1`, { headers: headers(token), cache: "no-store" });
  if (!r.ok) return null;
  const p = (await r.json())?.[0];
  return p?.active && ["NEXUS_ROOT", "NEXUS_ADMIN"].includes(p.profile) ? { token, userId: p.user_id } : null;
}
async function sb(token, path, options = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: headers(token, options.headers || {}), cache: "no-store" });
  let data = null; try { data = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, data };
}
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a,b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80:");
  }
  return true;
}
async function validateEndpoint(raw) {
  let url;
  try { url = new URL(String(raw || "").trim()); } catch { throw new Error("Informe uma URL HTTPS válida no campo Identificador."); }
  if (url.protocol !== "https:") throw new Error("O monitor aceita somente endpoints HTTPS.");
  const host = url.hostname.toLowerCase();
  if (["localhost", "localhost.localdomain"].includes(host) || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Endpoint local/interno não é permitido.");
  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) throw new Error("O endpoint resolve para rede privada/interna e não pode ser monitorado.");
  return url;
}

export async function POST(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return NextResponse.json({ message: "Acesso ROOT necessário." }, { status: 403 });
  let body = {}; try { body = await request.json(); } catch {}
  if (!body.serviceId) return NextResponse.json({ message: "Serviço de API não informado." }, { status: 400 });

  const found = await sb(ctx.token, `nexus_infra_services?id=eq.${encodeURIComponent(body.serviceId)}&select=*&limit=1`);
  const service = found.data?.[0];
  if (!service) return NextResponse.json({ message: "Serviço não encontrado." }, { status: 404 });

  let endpoint;
  try { endpoint = await validateEndpoint(service.resource_identifier); }
  catch (error) { return NextResponse.json({ message: error.message }, { status: 400 }); }

  const startedAt = new Date().toISOString();
  const started = Date.now();
  let httpStatus = null, latencyMs = null, finalUrl = endpoint.toString(), ok = false, errorMessage = null;
  try {
    const response = await fetch(endpoint, { method: "GET", redirect: "follow", cache: "no-store", headers: { Accept: "application/json,text/plain,*/*", "User-Agent": "PLENIUM-Infrastructure-Monitor/1.0" }, signal: AbortSignal.timeout(10000) });
    latencyMs = Date.now() - started;
    httpStatus = response.status;
    finalUrl = response.url || finalUrl;
    ok = response.status >= 200 && response.status < 400;
    try { await response.body?.cancel(); } catch {}
  } catch (error) {
    latencyMs = Date.now() - started;
    errorMessage = String(error?.name === "TimeoutError" ? "Tempo limite de 10 segundos excedido." : error?.message || error);
  }

  const now = new Date().toISOString();
  const previous = service.metadata?.api || {};
  const previousFailures = Number(previous.consecutiveFailures || 0);
  const consecutiveFailures = ok ? 0 : previousFailures + 1;
  let health = "ONLINE";
  if (!ok && consecutiveFailures >= 3) health = "OFFLINE";
  else if (!ok) health = "ATTENTION";
  else if (latencyMs > 3000) health = "DEGRADED";

  const metadata = { ...(service.metadata || {}), api: { endpoint: endpoint.toString(), checkedAt: now, ok, httpStatus, latencyMs, finalUrl, consecutiveFailures, error: errorMessage } };
  const update = await sb(ctx.token, `nexus_infra_services?id=eq.${encodeURIComponent(service.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ health_status: health, last_checked_at: now, metadata }) });
  if (!update.ok) return NextResponse.json({ message: "API consultada, mas não foi possível gravar o resultado.", details: update.data }, { status: 500 });

  await sb(ctx.token, "nexus_infra_sync_runs", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify([{ service_id: service.id, provider: "API", status: ok ? "SUCCESS" : "ERROR", metrics_count: 2, message: ok ? `HTTP ${httpStatus} em ${latencyMs} ms.` : `Falha ${consecutiveFailures}/3: ${errorMessage || `HTTP ${httpStatus}`}`, started_at: startedAt, finished_at: now, created_by: ctx.userId }]) });

  return NextResponse.json({ status: ok ? "SUCCESS" : "ERROR", health, httpStatus, latencyMs, finalUrl, consecutiveFailures, error: errorMessage });
}
