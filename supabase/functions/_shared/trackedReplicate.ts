import {
  cancelSubmittedPredictionIfStopped,
  claimJob,
  DEFAULT_MAX_ATTEMPTS,
  isStopped,
  updateJob,
  waitForActiveJob,
} from "./providerJobs.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const GATEWAY = "https://connector-gateway.lovable.dev/replicate/v1";

interface TrackedImageOptions {
  supabase: SB;
  rowId: string;
  jobKey: string;
  model: string;
  input: Record<string, unknown>;
  lovableApiKey: string;
  replicateApiKey: string;
  pollLimit?: number;
  pollIntervalMs?: number;
}

export interface TrackedImageResult {
  bytes: Uint8Array;
  jobId: string;
}

interface TrackedTextOptions {
  supabase: SB;
  rowId: string;
  jobKey: string;
  model: string;
  input: Record<string, unknown>;
  lovableApiKey: string;
  replicateApiKey: string;
  pollLimit?: number;
}

async function readStoredText(supabase: SB, jobId: string): Promise<string | null> {
  const { data } = await supabase
    .from("animation_provider_jobs")
    .select("output_data")
    .eq("id", jobId)
    .maybeSingle();
  return typeof data?.output_data === "string" ? data.output_data : null;
}

async function fetchImage(url: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Replicate image fetch failed: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

// Submits at most one provider prediction for a logical still attempt. The
// SQL claim is the billing boundary: only claimed=true may POST. Concurrent
// callers wait for and reuse the winner's prediction or stored output.
export async function generateTrackedReplicateImage(
  options: TrackedImageOptions,
): Promise<TrackedImageResult> {
  const {
    supabase,
    rowId,
    jobKey,
    model,
    input,
    lovableApiKey,
    replicateApiKey,
    pollLimit = 90,
    pollIntervalMs = 3_000,
  } = options;

  const claim = await claimJob(
    supabase,
    rowId,
    jobKey,
    "replicate",
    model,
    DEFAULT_MAX_ATTEMPTS,
  );
  const job = claim.job;

  if (job.status === "succeeded" && job.output_url) {
    return { bytes: await fetchImage(job.output_url), jobId: job.id };
  }
  if (claim.exhausted) {
    throw new Error(`${jobKey} attempt cap reached (initial + 2 retries)`);
  }

  let predictionId = job.prediction_id;
  if (claim.claimed) {
    if (await isStopped(supabase, rowId)) throw new Error("stopped");
    await updateJob(supabase, job.id, { status: "submitting", error: null });

    const response = await fetch(`${GATEWAY}/models/${model}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": replicateApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    });
    if (!response.ok) {
      const body = await response.text();
      await updateJob(supabase, job.id, {
        status: "failed",
        error: `create ${response.status}: ${body.slice(0, 240)}`,
      });
      throw new Error(`Replicate create failed: ${response.status} ${body.slice(0, 240)}`);
    }

    const prediction = await response.json();
    predictionId = typeof prediction?.id === "string" ? prediction.id : null;
    if (!predictionId) {
      await updateJob(supabase, job.id, { status: "failed", error: "missing prediction id" });
      throw new Error("Replicate: no prediction id");
    }
    await updateJob(supabase, job.id, {
      status: "running",
      prediction_id: predictionId,
    });
    if (await cancelSubmittedPredictionIfStopped(
      supabase,
      rowId,
      job.id,
      predictionId,
      lovableApiKey,
      replicateApiKey,
    )) {
      throw new Error("stopped");
    }
  } else {
    const winner = await waitForActiveJob(supabase, job.id, 60_000);
    if (winner.status === "succeeded" && winner.output_url) {
      return { bytes: await fetchImage(winner.output_url), jobId: job.id };
    }
    if (["failed", "canceled", "expired"].includes(winner.status)) {
      throw new Error(`${jobKey} winner ended ${winner.status}`);
    }
    predictionId = winner.prediction_id;
    if (!predictionId) throw new Error(`${jobKey} winner never stored a prediction id`);
  }

  for (let index = 0; index < pollLimit; index++) {
    await new Promise((resolve) => setTimeout(resolve, index < 5 ? 2_000 : pollIntervalMs));
    if (await isStopped(supabase, rowId)) {
      throw new Error("stopped");
    }

    const response = await fetch(`${GATEWAY}/predictions/${predictionId}`, {
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": replicateApiKey,
      },
    });
    if (!response.ok) continue;

    const prediction = await response.json();
    if (prediction.status === "succeeded") {
      const outputUrl = Array.isArray(prediction.output)
        ? prediction.output[0]
        : prediction.output;
      if (typeof outputUrl !== "string") {
        await updateJob(supabase, job.id, { status: "failed", error: "invalid output URL" });
        throw new Error("Replicate: invalid output URL");
      }
      await updateJob(supabase, job.id, { status: "succeeded", output_url: outputUrl, error: null });
      return { bytes: await fetchImage(outputUrl), jobId: job.id };
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      await updateJob(supabase, job.id, {
        status: prediction.status,
        error: typeof prediction.error === "string" ? prediction.error : null,
      });
      throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error ?? ""}`);
    }
  }

  // A local polling timeout does not prove the provider job is terminal.
  // Keep it active so a retry resumes polling the same prediction id.
  await updateJob(supabase, job.id, { status: "running", error: "poll timeout; provider status unknown" });
  throw new Error("Replicate prediction timed out");
}

// Text generation is also a Replicate submission. Persist its id, status,
// and reusable output so a duplicate invocation for the same animation run
// cannot create a second billed prediction.
export async function generateTrackedReplicateText(
  options: TrackedTextOptions,
): Promise<string> {
  const {
    supabase,
    rowId,
    jobKey,
    model,
    input,
    lovableApiKey,
    replicateApiKey,
    pollLimit = 90,
  } = options;
  const claim = await claimJob(
    supabase,
    rowId,
    jobKey,
    "replicate",
    model,
    DEFAULT_MAX_ATTEMPTS,
  );
  const job = claim.job;

  if (job.status === "succeeded") {
    const stored = await readStoredText(supabase, job.id);
    if (stored) return stored;
    throw new Error(`${jobKey} succeeded without stored output`);
  }
  if (claim.exhausted) {
    throw new Error(`${jobKey} attempt cap reached (initial + 2 retries)`);
  }

  let predictionId = job.prediction_id;
  if (claim.claimed) {
    if (await isStopped(supabase, rowId)) throw new Error("stopped");
    await updateJob(supabase, job.id, { status: "submitting", error: null });
    const response = await fetch(`${GATEWAY}/models/${model}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": replicateApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    });
    if (!response.ok) {
      const body = await response.text();
      await updateJob(supabase, job.id, {
        status: "failed",
        error: `create ${response.status}: ${body.slice(0, 240)}`,
      });
      throw new Error(`Replicate text create failed: ${response.status}`);
    }
    const prediction = await response.json();
    predictionId = typeof prediction?.id === "string" ? prediction.id : null;
    if (!predictionId) {
      await updateJob(supabase, job.id, { status: "failed", error: "missing prediction id" });
      throw new Error("Replicate text: no prediction id");
    }
    await updateJob(supabase, job.id, {
      status: "running",
      prediction_id: predictionId,
    });
    if (await cancelSubmittedPredictionIfStopped(
      supabase,
      rowId,
      job.id,
      predictionId,
      lovableApiKey,
      replicateApiKey,
    )) throw new Error("stopped");
  } else {
    const winner = await waitForActiveJob(supabase, job.id, 60_000);
    if (winner.status === "succeeded") {
      const stored = await readStoredText(supabase, job.id);
      if (stored) return stored;
    }
    if (["failed", "canceled", "expired"].includes(winner.status)) {
      throw new Error(`${jobKey} winner ended ${winner.status}`);
    }
    predictionId = winner.prediction_id;
    if (!predictionId) throw new Error(`${jobKey} winner never stored a prediction id`);
  }

  for (let index = 0; index < pollLimit; index++) {
    await new Promise((resolve) => setTimeout(resolve, index < 5 ? 1_000 : 2_500));
    if (await isStopped(supabase, rowId)) throw new Error("stopped");
    const response = await fetch(`${GATEWAY}/predictions/${predictionId}`, {
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": replicateApiKey,
      },
    });
    if (!response.ok) continue;
    const prediction = await response.json();
    if (prediction.status === "succeeded") {
      const output = Array.isArray(prediction.output)
        ? prediction.output.join("")
        : prediction.output;
      if (typeof output !== "string" || !output.trim()) {
        await updateJob(supabase, job.id, { status: "failed", error: "empty text output" });
        throw new Error("Replicate text: empty output");
      }
      await updateJob(supabase, job.id, {
        status: "succeeded",
        output_data: output,
        error: null,
      });
      return output;
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      await updateJob(supabase, job.id, {
        status: prediction.status,
        error: typeof prediction.error === "string" ? prediction.error : null,
      });
      throw new Error(`Replicate text prediction ${prediction.status}`);
    }
  }

  await updateJob(supabase, job.id, {
    status: "running",
    error: "poll timeout; provider status unknown",
  });
  throw new Error("Replicate text timed out");
}
