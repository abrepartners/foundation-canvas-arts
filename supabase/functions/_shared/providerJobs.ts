// Durable idempotency for third-party provider submissions (Replicate/Kling/
// stitch). One active row per (row_id, job_key) is enforced by a partial
// unique index in the database, so concurrent invocations cannot both POST.
// deno-lint-ignore no-explicit-any
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

export type ClaimResult =
  | { claimed: true; job: ProviderJob }
  | { claimed: false; job: ProviderJob };

// Atomically claim (row_id, job_key). If an active row already exists we
// return it so the caller can resume polling instead of re-submitting.
export async function claimJob(
  supabase: SB,
  rowId: string,
  jobKey: string,
  provider = "replicate",
  model?: string,
): Promise<ClaimResult> {
  // Latest attempt for this key (any status)
  const { data: latest } = await supabase
    .from("animation_provider_jobs")
    .select("*")
    .eq("row_id", rowId)
    .eq("job_key", jobKey)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest && ["claimed", "submitting", "running"].includes(latest.status)) {
    return { claimed: false, job: latest as ProviderJob };
  }
  if (latest && latest.status === "succeeded") {
    return { claimed: false, job: latest as ProviderJob };
  }

  const nextAttempt = latest ? (latest.attempt as number) + 1 : 1;
  const insertPayload = {
    row_id: rowId,
    job_key: jobKey,
    provider,
    model: model ?? null,
    status: "claimed",
    attempt: nextAttempt,
  };
  const { data: inserted, error } = await supabase
    .from("animation_provider_jobs")
    .insert(insertPayload)
    .select("*")
    .single();

  if (!error && inserted) return { claimed: true, job: inserted as ProviderJob };

  // Lost the race — someone else claimed between our SELECT and INSERT.
  const { data: existing } = await supabase
    .from("animation_provider_jobs")
    .select("*")
    .eq("row_id", rowId)
    .eq("job_key", jobKey)
    .in("status", ["claimed", "submitting", "running", "succeeded"])
    .order("attempt", { ascending: false })
    .limit(1)
    .single();
  if (existing) return { claimed: false, job: existing as ProviderJob };
  throw new Error(`claimJob failed: ${error?.message ?? "unknown"}`);
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
