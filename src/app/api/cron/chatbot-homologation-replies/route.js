import { timingSafeEqual } from "node:crypto";
import { basicReply } from "../../portal/chatbot/basic-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = "7ca2ee92-6b12-4f54-ba7b-986bab2f9434";
const PHONE = "1295394797000036";
const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

// Synthetic test suite only. No database, Meta API, outbound queue, or wallet access.
export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") || "";
  const expected = secret ? `Bearer ${secret}` : "";
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (process.env.CHATBOT_HOMOLOGATION_AUDIT_ENABLED !== "true" ||
      process.env.CHATBOT_HOMOLOGATION_ORGANIZATION_ID !== ROOT ||
      process.env.CHATBOT_HOMOLOGATION_PHONE_NUMBER_ID !== PHONE) {
    return json({ error: "Homologation allowlist disabled" }, 503);
  }
  const config = {
    active: true,
    welcome_message: "Olá! Este é o ambiente de homologação da PLENIUM.",
    closing_message: "Obrigado! Esta conversa foi apenas uma simulação.",
    faq: [
      { question: "Quais serviços vocês oferecem?", answer: "A PLENIUM oferece soluções de gestão e automação para negócios." },
      { question: "Como posso falar com um atendente?", answer: "Um atendente poderá orientar você sobre as soluções da PLENIUM." },
    ],
  };
  const cases = [
    { scenario: "saudacao", input: "Olá", expected_type: "welcome" },
    { scenario: "boa_noite", input: "Boa noite", expected_type: "welcome" },
    { scenario: "faq_exata", input: "Quais serviços vocês oferecem?", expected_type: "faq" },
    { scenario: "faq_atendente", input: "Como posso falar com um atendente?", expected_type: "faq" },
    { scenario: "pergunta_desconhecida", input: "Vocês alugam foguetes?", expected_type: "fallback" },
    { scenario: "encerramento", input: "Obrigado", expected_type: "closing" },
    { scenario: "repeticao_1", input: "Olá", expected_type: "welcome" },
    { scenario: "repeticao_2", input: "Olá", expected_type: "welcome" },
  ];
  const results = cases.map(({ scenario, input, expected_type }) => {
    const response = basicReply(config, input);
    return { scenario, input, expected_type, response_type: response?.type ?? null,
      simulated_reply: response?.reply ?? null, passed: response?.type === expected_type };
  });
  return json({ mode: "synthetic_basic_reply_test", scope: "root_phone_only",
    sending_enabled: false, database_modified: false, events_modified: false,
    credits_debited: false, contracts_consulted: false, wallets_consulted: false,
    total: results.length, passed: results.filter(x => x.passed).length,
    failed: results.filter(x => !x.passed).length, results });
}
