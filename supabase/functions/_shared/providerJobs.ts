// Durable idempotency for third-party provider submissions (Replicate/Kling/
// stitch). Uses the claim_provider_job SQL RPC so claiming, attempt counting,
// and terminal-attempt caps are serialised on the parent botanical_animated
// row. Loser calls MUST NOT POST to the provider — they wait via
// waitForActiveJob until the winner records prediction_id or reaches a
// terminal status.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type JobStatus =
  | "claimed"
  | "submitting"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled"
  | "expired";

export interface ProviderJob {
  id: string;
  row_id: string;
  job_key: string;
  provider: string;
  model: string | null;
  prediction_id: string | null;
  status: JobStatus;
  attempt: number;
  output_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimOutcome {
  claimed: boolean; // true only when this call created a new attempt row
  exhausted: boolean; // attempt cap reached; no new work should be started
  job: ProviderJob;
}

export const DEFAULT_MAX_ATTEMPTS = 3;

// Atomic claim via SQL RPC. Only ONE caller ever sees claimed=true for a
// given (row_id, job_key) attempt. Everyone else sees the existing active
// or reuseable succeeded row.
export async function claimJob(
  supabase: SB,
  rowId: string,
  jobKey: string,
  provider = "replicate",
  model?: string,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<ClaimOutcome> {
  const { data, error } = await supabase.rpc("claim_provider_job", {
    _row_id: rowId,
    _job_key: jobKey,
    _provider: provider,
    _model: model ?? null,
    _max_attempts: maxAttempts,
  });
  if (error) throw new Error(`claim_provider_job failed: ${error.message}`);
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) throw new Error("claim_provider_job returned no row");
  const nowIso = new Date().toISOString();
  const job: ProviderJob = {
    id: r.job_id,
    row_id: rowId,
    job_key: jobKey,
    provider,
    model: model ?? null,
    prediction_id: r.prediction_id ?? null,
    status: r.job_status as JobStatus,
    attempt: r.attempt,
    output_url: r.output_url ?? null,
    error: null,
    created_at: nowIso,
    updated_at: nowIso,
  };
  return { claimed: !!r.claimed, exhausted: !!r.exhausted, job };
}

// Loser path: block until the winner records a prediction_id or the winning
// attempt reaches a terminal status. Returns the latest snapshot regardless.
export async function waitForActiveJob(
  supabase: SB,
  jobId: string,
  timeoutMs = 60_000,
  intervalMs = 1500,
): Promise<{ status: JobStatus; prediction_id: string | null; output_url: string | null }> {
  const deadline = Date.now() + timeoutMs;
  let last: { status: JobStatus; prediction_id: string | null; output_url: string | null } = {
    status: "claimed",
    prediction_id: null,
    output_url: null,
  };
  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("animation_provider_jobs")
      .select("status, prediction_id, output_url")
      .eq("id", jobId)
      .maybeSingle();
    if (data) {
      last = data as typeof last;
      if (last.prediction_id) return last;
      if (["succeeded", "failed", "canceled", "expired"].includes(last.status)) return last;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}

export async function updateJob(
  supabase: SB,
  jobId: string,
  patch: Partial<ProviderJob>,
): Promise<void> {
  await supabase
    .from("animation_provider_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

// Returns true if the parent botanical_animated row has been stopped or
// moved into a terminal state. All long-running loops must call this.
export async function isStopped(supabase: SB, rowId: string): Promise<boolean> {
  const { data } = await supabase
    .from("botanical_animated")
    .select("queue_status, stop_requested_at")
    .eq("id", rowId)
    .maybeSingle();
  if (!data) return true;
  if (data.stop_requested_at) return true;
  if (["canceled", "error", "done"].includes(data.queue_status)) return true;
  return false;
}

// Best-effort provider-side cancel via Replicate's cancel endpoint.
export async function cancelReplicatePrediction(
  predictionId: string,
  lovableApiKey: string,
  replicateApiKey: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `https://connector-gateway.lovable.dev/replicate/v1/predictions/${predictionId}/cancel`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": replicateApiKey,
    },
  });
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body };
}
