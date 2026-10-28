// Transactional execution plan for inbound queue jobs.
// Read-only by design. No claim, Meta send, wallet reserve or finalization.
// Reuses the deployed preflight checks; fail closed on any abnormal response.
import { GET as preflight } from "../chatbot-queue-preflight/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});

export async function GET(request) {
  // The preflight endpoint owns authorization and all database reads.
  // Never expose decisions if authorization failed.
  const result = await preflight(request);
  if (!result.ok) return result;

  let data;
  try { data = await result.json(); }
  catch { return json({ error: "Invalid preflight response" }, 503); }

  if (data?.mode !== "queue_preflight_read_only" ||
      !Array.isArray(data.decisions) ||
      !Number.isInteger(data.jobs_scanned) ||
      data.jobs_scanned !== data.decisions.length ||
      data.sending_enabled !== false ||
      data.credits_debited !== false ||
      data.jobs_claimed !== false ||
      data.database_modified !== false) {
    return json({ error: "Unsafe preflight response" }, 503);
  }

  const jobs = data.decisions.map((decision) => {
    const eligible = decision?.eligible === true && decision.reason === "preflight_eligible";
    return {
      job_id: decision?.job_id || null,
      eligible,
      reason: decision?.reason || "invalid_decision",
      response_type: eligible ? (decision.response_type || null) : null,
      // The sequence below is DOCUMENTATION, not executable actions.
      planned_steps: eligible ? [
        "atomic_claim_with_lease",
        "revalidate_contract_wallet_and_human_pause",
        "reserve_outbound_idempotently",
        "recheck_human_pause_before_meta_send",
        "send_to_meta_once",
        "finalize_outbound_by_meta_outcome",
        "finish_inbound_job_with_claim_token",
      ] : [],
    };
  });

  return json({
    mode: "queue_transaction_plan_read_only",
    jobs_scanned: data.jobs_scanned,
    eligible_jobs: jobs.filter((job) => job.eligible).length,
    jobs,
    execution_enabled: false,
    meta_sending_enabled: false,
    credits_debited: false,
    jobs_claimed: false,
    database_modified: false,
    production_ready: false,
  });
}
