// Diagnostic only. Never admits, claims, sends, reserves, or finalizes.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "Unauthorized" }, 401);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return json({ error: "Storage unavailable" }, 503);
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const query = async (table, qs) => {
    const res = await fetch(`${base}/rest/v1/${table}?${qs}`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`${table}_http_${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(`${table}_invalid_response`);
    return rows;
  };
  try {
    const [events, jobs] = await Promise.all([
      query("nexus_whatsapp_webhook_events", "select=id,organization_id,phone_number_id,event_payload,processing_status&order=received_at.desc&limit=100"),
      query("nexus_chatbot_inbound_jobs", "select=id,source_event_id,state&order=created_at.desc&limit=100"),
    ]);
    const byState = {};
    for (const job of jobs) byState[job.state || "unknown"] = (byState[job.state || "unknown"] || 0) + 1;
    let inboundEvents = 0, inboundMessages = 0, statusOnly = 0, echoes = 0, unsupported = 0;
    const inboundEventIds = new Set();
    for (const event of events) {
      let inbound = 0, statuses = false, echo = false;
      for (const entry of event.event_payload?.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === "smb_message_echoes") echo = true;
          if (change.field === "messages") {
            if (Array.isArray(change.value?.messages)) inbound += change.value.messages.length;
            if (Array.isArray(change.value?.statuses) && change.value.statuses.length) statuses = true;
          }
        }
      }
      if (inbound) { inboundEvents++; inboundMessages += inbound; inboundEventIds.add(event.id); }
      else if (echo) echoes++;
      else if (statuses) statusOnly++;
      else unsupported++;
    }
    const linkedJobsInSample = jobs.filter(j => inboundEventIds.has(j.source_event_id)).length;
    const enabled = process.env.CHATBOT_INBOUND_QUEUE_ADMISSION_ENABLED === "true";
    return json({
      mode: "chatbot_admission_diagnostic_read_only",
      admission_feature_flag_enabled: enabled,
      recent_events_sampled: events.length,
      recent_inbound_events: inboundEvents,
      recent_inbound_messages: inboundMessages,
      recent_status_only_events: statusOnly,
      recent_echo_events: echoes,
      recent_other_events: unsupported,
      recent_jobs_sampled: jobs.length,
      recent_jobs_by_state: byState,
      recent_jobs_linked_to_sampled_inbound_events: linkedJobsInSample,
      sample_limit: 100,
      scope_note: "Samples of latest 100 rows per table, not global totals. Historic events are not automatically admitted when the feature flag changes.",
      suggested_next_step: !enabled ? "review_feature_flag_before_authorizing_admission" : inboundMessages === 0 ? "inspect_inbound_event_generation" : linkedJobsInSample === 0 ? "review_admission_rpc_and_webhook_logs" : "review_queue_state_and_processing",
      database_modified: false, admission_rpc_invoked: false, mutation_rpcs_invoked: false,
      credits_debited: false, meta_messages_sent: false, automatic_execution_authorized: false,
    });
  } catch (error) {
    console.error("chatbot_admission_diagnostic_failed", error?.message || "unknown");
    return json({ error: "Diagnostic unavailable" }, 503);
  }
}
