import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const TEST_MODEL = process.env.GROQ_SMOKE_MODEL || "qwen/qwen3.8-27b";

function response(payload, status = 200) {
  return NextResponse.json(payload, { status });
}

function getToken(request) {
  const header = request.headers.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return request.cookies.get("nexus_access_token")?.value || "";
}

async function requireRoot(request) {
  const token = getToken(request);
  if (!token || !SUPABASE_URL || !SUPABASE_KEY) return null;

  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!authResponse.ok) return null;

  const authUser = await authResponse.json();
  if (!authUser?.id) return null;

  const key = SERVICE_ROLE || SUPABASE_KEY;
  const auth = SERVICE_ROLE || token;
  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/nexus_user_profiles?user_id=eq.${encodeURIComponent(authUser.id)}&select=user_id,profile,active&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${auth}` },
      cache: "no-store",
    }
  );
  if (!profileResponse.ok) return null;

  const profile = (await profileResponse.json())?.[0];
  if (!profile?.active || !["NEXUS_ROOT", "NEXUS_ADMIN"].includes(profile.profile)) return null;
  return { userId: profile.user_id, profile: profile.profile };
}

async function groqFetch(path, options = {}) {
  const startedAt = Date.now();
  try {
    const res = await fetch(`${GROQ_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 1200) }; }
    return { ok: res.ok, status: res.status, latencyMs: Date.now() - startedAt, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      data: { error: { message: error?.message || String(error) } },
    };
  }
}

export async function GET(request) {
  const ctx = await requireRoot(request);
  if (!ctx) {
    return response({
      ok: false,
      stage: "root_auth",
      code: "ROOT_REQUIRED",
      message: "Acesso ROOT necessário para executar o teste Groq.",
    }, 403);
  }

  if (!GROQ_API_KEY) {
    return response({
      ok: false,
      stage: "environment",
      code: "GROQ_API_KEY_MISSING",
      message: "GROQ_API_KEY não está configurada no ambiente deste deployment.",
      model: TEST_MODEL,
    }, 503);
  }

  const models = await groqFetch("/models", { method: "GET" });
  if (!models.ok) {
    return response({
      ok: false,
      stage: "models_endpoint",
      code: "GROQ_MODELS_FAILED",
      message: models.data?.error?.message || "A Groq recusou a consulta ao catálogo de modelos.",
      groqHttpStatus: models.status,
      latencyMs: models.latencyMs,
      model: TEST_MODEL,
      groqError: models.data?.error || models.data || null,
    }, models.status >= 400 && models.status < 600 ? models.status : 502);
  }

  const availableModels = Array.isArray(models.data?.data) ? models.data.data.map((item) => item?.id).filter(Boolean) : [];
  const modelAvailable = availableModels.includes(TEST_MODEL);

  if (!modelAvailable) {
    return response({
      ok: false,
      stage: "model_resolution",
      code: "GROQ_MODEL_NOT_AVAILABLE",
      message: `O modelo ${TEST_MODEL} não foi localizado no catálogo retornado pela Groq para esta conta.`,
      model: TEST_MODEL,
      catalogModelCount: availableModels.length,
      nearbyModels: availableModels.filter((id) => /qwen/i.test(id)).slice(0, 20),
      latencyMs: models.latencyMs,
    }, 409);
  }

  const completion = await groqFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: TEST_MODEL,
      messages: [
        {
          role: "system",
          content: "Responda apenas JSON válido, sem markdown.",
        },
        {
          role: "user",
          content: 'Classifique esta solicitação em FINANCEIRO, SUPORTE, COMERCIAL ou OUTRO: "Preciso da segunda via do boleto deste mês." Responda com as chaves categoria e justificativa.',
        },
      ],
      temperature: 0,
      max_tokens: 180,
      response_format: { type: "json_object" },
    }),
  });

  if (!completion.ok) {
    return response({
      ok: false,
      stage: "chat_completions",
      code: "GROQ_COMPLETION_FAILED",
      message: completion.data?.error?.message || "A chamada de Chat Completions da Groq falhou.",
      groqHttpStatus: completion.status,
      model: TEST_MODEL,
      catalogModelCount: availableModels.length,
      modelsLatencyMs: models.latencyMs,
      completionLatencyMs: completion.latencyMs,
      groqError: completion.data?.error || completion.data || null,
    }, completion.status >= 400 && completion.status < 600 ? completion.status : 502);
  }

  const choice = completion.data?.choices?.[0]?.message?.content ?? null;
  return response({
    ok: true,
    stage: "completed",
    code: "GROQ_SMOKE_OK",
    message: "Conexão direta com a Groq concluída com sucesso.",
    model: TEST_MODEL,
    modelAvailable: true,
    catalogModelCount: availableModels.length,
    modelsLatencyMs: models.latencyMs,
    completionLatencyMs: completion.latencyMs,
    usage: completion.data?.usage || null,
    output: choice,
  });
}
