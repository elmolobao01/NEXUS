import { NextResponse } from "next/server";
import dns from "node:dns/promises";
import tls from "node:tls";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function headers(token, extra = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra };
}
function getToken(request) { return request.cookies.get("nexus_access_token")?.value || ""; }
async function requireRoot(request) {
  const token = getToken(request);
  if (!token || !SUPABASE_URL || !SUPABASE_KEY) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/nexus_user_profiles?select=user_id,profile,active&limit=1`, { headers: headers(token), cache: "no-store" });
  if (!r.ok) return null;
  const rows = await r.json();
  const p = rows?.[0];
  return p?.active && ["NEXUS_ROOT", "NEXUS_ADMIN"].includes(p.profile) ? { token, userId: p.user_id } : null;
}
async function sb(token, path, options = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: headers(token, options.headers || {}), cache: "no-store" });
  let data = null; try { data = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, data };
}
function normalizeDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/:\d+$/, "");
}
function eventDate(rdap, actions) {
  const wanted = new Set(actions);
  const event = Array.isArray(rdap?.events) ? rdap.events.find((item) => wanted.has(String(item?.eventAction || "").toLowerCase())) : null;
  return event?.eventDate || null;
}
function entityName(rdap) {
  const registrar = Array.isArray(rdap?.entities)
    ? rdap.entities.find((entity) => Array.isArray(entity?.roles) && entity.roles.includes("registrar"))
    : null;
  const fn = registrar?.vcardArray?.[1]?.find?.((row) => row?.[0] === "fn");
  return fn?.[3] || registrar?.handle || null;
}
async function fetchRdap(domain) {
  const urls = domain.endsWith(".br")
    ? [`https://rdap.registro.br/domain/${encodeURIComponent(domain)}`, `https://rdap.org/domain/${encodeURIComponent(domain)}`]
    : [`https://rdap.org/domain/${encodeURIComponent(domain)}`];
  let lastError = null;
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/rdap+json, application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!r.ok) { lastError = new Error(`RDAP HTTP ${r.status}`); continue; }
      return await r.json();
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("RDAP indisponível.");
}
async function resolveDns(domain) {
  const result = { ok: false, addresses: [], cname: [], nameservers: [], error: null };
  try {
    const [addresses, cname, nameservers] = await Promise.all([
      dns.resolve4(domain).catch(() => []),
      dns.resolveCname(domain).catch(() => []),
      dns.resolveNs(domain).catch(() => []),
    ]);
    result.addresses = addresses;
    result.cname = cname;
    result.nameservers = nameservers;
    result.ok = addresses.length > 0 || cname.length > 0;
  } catch (error) { result.error = String(error?.message || error); }
  return result;
}
function inspectSsl(domain) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: domain, port: 443, servername: domain, rejectUnauthorized: false, timeout: 8000 }, () => {
      try {
        const cert = socket.getPeerCertificate();
        const validTo = cert?.valid_to ? new Date(cert.valid_to).toISOString() : null;
        const validFrom = cert?.valid_from ? new Date(cert.valid_from).toISOString() : null;
        const authorized = socket.authorized;
        resolve({ ok: Boolean(cert && validTo && new Date(validTo) > new Date()), authorized, validFrom, validTo, issuer: cert?.issuer?.O || cert?.issuer?.CN || null, subject: cert?.subject?.CN || null, authorizationError: socket.authorizationError || null });
      } catch (error) { resolve({ ok: false, error: String(error?.message || error) }); }
      socket.end();
    });
    socket.on("timeout", () => { socket.destroy(); resolve({ ok: false, error: "Tempo limite ao consultar SSL." }); });
    socket.on("error", (error) => resolve({ ok: false, error: String(error?.message || error) }));
  });
}

export async function POST(request) {
  const ctx = await requireRoot(request);
  if (!ctx) return NextResponse.json({ message: "Acesso ROOT necessário." }, { status: 403 });

  let body = {};
  try { body = await request.json(); } catch {}
  const serviceId = body.serviceId;
  if (!serviceId) return NextResponse.json({ message: "Serviço de domínio não informado." }, { status: 400 });

  const serviceResult = await sb(ctx.token, `nexus_infra_services?id=eq.${encodeURIComponent(serviceId)}&select=*&limit=1`);
  const service = serviceResult.data?.[0];
  if (!service) return NextResponse.json({ message: "Serviço não encontrado." }, { status: 404 });

  const domain = normalizeDomain(service.resource_identifier || service.name);
  if (!domain || !domain.includes(".")) return NextResponse.json({ message: "Informe o domínio no campo Identificador, por exemplo pleniumgestao.com.br." }, { status: 400 });

  const startedAt = new Date().toISOString();
  const errors = [];
  let rdap = null;
  try { rdap = await fetchRdap(domain); } catch (error) { errors.push(`RDAP: ${error.message}`); }
  const dnsResult = await resolveDns(domain);
  if (!dnsResult.ok) errors.push(`DNS: ${dnsResult.error || "sem resolução A/CNAME"}`);
  const sslResult = await inspectSsl(domain);
  if (!sslResult.ok) errors.push(`SSL: ${sslResult.error || sslResult.authorizationError || "certificado não confirmado"}`);

  const registrationAt = rdap ? eventDate(rdap, ["registration", "registered"]) : null;
  const expirationAt = rdap ? eventDate(rdap, ["expiration", "expiry", "expired"]) : null;
  const rdapNameservers = Array.isArray(rdap?.nameservers) ? rdap.nameservers.map((item) => item?.ldhName).filter(Boolean) : [];
  const nameservers = [...new Set([...(dnsResult.nameservers || []), ...rdapNameservers])];
  const registrar = entityName(rdap) || (domain.endsWith(".br") ? "Registro.br" : service.provider || null);

  const sslDays = sslResult.validTo ? Math.ceil((new Date(sslResult.validTo) - new Date()) / 86400000) : null;
  const expiryDays = expirationAt ? Math.ceil((new Date(expirationAt) - new Date()) / 86400000) : null;
  let health = dnsResult.ok && sslResult.ok ? "ONLINE" : "ATTENTION";
  if ((sslDays !== null && sslDays < 0) || (expiryDays !== null && expiryDays < 0)) health = "OFFLINE";
  else if ((sslDays !== null && sslDays <= 30) || (expiryDays !== null && expiryDays <= 30)) health = "ATTENTION";

  const now = new Date().toISOString();
  const metadata = {
    ...(service.metadata || {}),
    domain: {
      name: domain,
      registrar,
      registrationAt,
      expirationAt,
      dnsOk: dnsResult.ok,
      addresses: dnsResult.addresses,
      cname: dnsResult.cname,
      nameservers,
      sslOk: sslResult.ok,
      sslAuthorized: sslResult.authorized ?? null,
      sslValidFrom: sslResult.validFrom || null,
      sslExpiresAt: sslResult.validTo || null,
      sslIssuer: sslResult.issuer || null,
      sslSubject: sslResult.subject || null,
      syncedAt: now,
      errors,
    },
  };

  const patch = {
    health_status: health,
    last_checked_at: now,
    metadata,
  };
  if (registrationAt) patch.started_on = String(registrationAt).slice(0, 10);
  if (expirationAt) {
    patch.expires_on = String(expirationAt).slice(0, 10);
    patch.renewal_on = String(expirationAt).slice(0, 10);
  }

  const update = await sb(ctx.token, `nexus_infra_services?id=eq.${encodeURIComponent(serviceId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  if (!update.ok) return NextResponse.json({ message: "Domínio consultado, mas não foi possível gravar o resultado.", details: update.data }, { status: 500 });

  const status = errors.length === 0 ? "SUCCESS" : "PARTIAL";
  await sb(ctx.token, "nexus_infra_sync_runs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([{ service_id: serviceId, provider: "DOMAIN", status, metrics_count: [rdap, dnsResult.ok, sslResult.ok].filter(Boolean).length, message: errors.length ? errors.join(" | ") : `Domínio ${domain}: RDAP, DNS e SSL verificados.`, started_at: startedAt, finished_at: now, created_by: ctx.userId }]),
  });

  return NextResponse.json({
    status,
    domain,
    registrar,
    registrationAt,
    expirationAt,
    dns: { ok: dnsResult.ok, addresses: dnsResult.addresses, cname: dnsResult.cname, nameservers },
    ssl: { ok: sslResult.ok, authorized: sslResult.authorized ?? null, validTo: sslResult.validTo || null, issuer: sslResult.issuer || null },
    health,
    warnings: errors,
  });
}
