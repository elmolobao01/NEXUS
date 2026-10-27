import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ROOT = '7ca2ee92-6b12-4f54-ba7b-986bab2f9434';
const PHONE = '1295394797000036';
const PAUSE_MS = 30 * 60 * 1000;
const reply = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

// Synthetic deterministic tests only: no database reads/writes, no Meta calls, no sends.
function decision({ organization, contact, now, events }) {
  const lastHuman = events
    .filter(e => e.organization === organization && e.contact === contact && e.kind === 'human_outbound' && e.at <= now)
    .reduce((last, e) => Math.max(last, e.at), -Infinity);
  const until = lastHuman === -Infinity ? null : lastHuman + PAUSE_MS;
  return { paused: until !== null && now < until, resume_at_ms: until };
}

export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  const expected = secret ? `Bearer ${secret}` : '';
  const actual = request.headers.get('authorization') || '';
  if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(actual) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) return reply({ error: 'Unauthorized' }, 401);
  if (process.env.CHATBOT_HOMOLOGATION_AUDIT_ENABLED !== 'true' ||
      process.env.CHATBOT_HOMOLOGATION_ORGANIZATION_ID !== ROOT ||
      process.env.CHATBOT_HOMOLOGATION_PHONE_NUMBER_ID !== PHONE) {
    return reply({ error: 'ROOT homologation disabled' }, 503);
  }

  const t = Date.parse('2026-10-27T12:00:00Z');
  const base = { organization: ROOT, contact: 'synthetic-contact-A', at: t };
  const human = { ...base, kind: 'human_outbound' };
  const bot = { ...base, kind: 'bot_outbound' };
  const otherContact = { ...human, contact: 'synthetic-contact-B' };
  const otherOrg = { ...human, organization: 'synthetic-other-organization' };
  const scenarios = [
    { name: 'sem_intervencao', now: t + 1000, events: [], expected: false },
    { name: 'pausa_imediata', now: t, events: [human], expected: true },
    { name: 'pausa_29m59s', now: t + PAUSE_MS - 1000, events: [human], expected: true },
    { name: 'retomada_30m', now: t + PAUSE_MS, events: [human], expected: false },
    { name: 'retomada_31m', now: t + PAUSE_MS + 60000, events: [human], expected: false },
    { name: 'nova_intervencao_reinicia_prazo', now: t + PAUSE_MS + 60000,
      events: [human, { ...human, at: t + 20 * 60000 }], expected: true },
    { name: 'mensagem_bot_nao_pausa', now: t + 1000, events: [bot], expected: false },
    { name: 'outro_contato_nao_pausa', now: t + 1000, events: [otherContact], expected: false },
    { name: 'outra_organizacao_nao_pausa', now: t + 1000, events: [otherOrg], expected: false },
    { name: 'evento_futuro_ignorado', now: t, events: [{ ...human, at: t + 1000 }], expected: false },
  ];
  const results = scenarios.map(s => {
    const got = decision({ organization: ROOT, contact: base.contact, now: s.now, events: s.events });
    return { scenario: s.name, expected_paused: s.expected, actual_paused: got.paused,
      passed: got.paused === s.expected };
  });
  return reply({ mode: 'synthetic_human_pause_test', scope: 'root_phone_only',
    pause_minutes: 30, automatic_resume: true, event_source_verified: false,
    production_integration_enabled: false, sending_enabled: false, database_modified: false,
    events_modified: false, credits_debited: false, contracts_modified: false,
    total: results.length, passed: results.filter(x => x.passed).length,
    failed: results.filter(x => !x.passed).length, results });
}
