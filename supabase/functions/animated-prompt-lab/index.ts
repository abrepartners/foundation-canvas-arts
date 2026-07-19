import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthorized } from "../_shared/auth.ts";
import { corsHeadersFor } from "../_shared/cors.ts";

const GATEWAY = "https://api.replicate.com/v1";
const PRICING_VERSION = "2026-07-19-a";
const PROMPT_VERSION = "botanical-motion-v1";
const DURATION_SECONDS = 5;
const START_FRAME_MODEL = "openai/gpt-image-2";
const START_FRAME_COST_USD = 0.128;
const ACTIVE_STATUSES = ["queued", "preparing_start_frame", "submitting_video", "running"];

const MODELS = {
  seedance_1_5_pro: {
    label: "Seedance 1.5 Pro",
    model: "bytedance/seedance-1.5-pro",
    resolution: "720p",
    cost_per_second_usd: 0.026,
    supports_last_frame: true,
    note: "Best-value default. Audio is disabled.",
  },
  seedance_2_mini: {
    label: "Seedance 2.0 Mini",
    model: "bytedance/seedance-2.0-mini",
    resolution: "720p",
    cost_per_second_usd: 0.09,
    supports_last_frame: true,
    note: "Higher-cost comparison model. Audio is disabled.",
  },
  kling_standard: {
    label: "Kling v2.1 Standard",
    model: "kwaivgi/kling-v2.1",
    resolution: "720p",
    cost_per_second_usd: 0.05,
    supports_last_frame: false,
    note: "Production-family fallback. Growth Reveal is unavailable.",
  },
} as const;

type ModelKey = keyof typeof MODELS;
type Archetype = "growth_reveal" | "living_specimen" | "archival_evidence";

const ARCHETYPES: Record<Archetype, { label: string; description: string }> = {
  growth_reveal: {
    label: "Growth Reveal",
    description: "A locked-camera time-lapse from a matched seed-stage plate to the selected mature specimen.",
  },
  living_specimen: {
    label: "Living Specimen",
    description: "Subtle leaf, tendril, stem, and pollen motion while the archival plate stays fixed.",
  },
  archival_evidence: {
    label: "Archival Evidence",
    description: "A restrained museum-light inspection that emphasizes texture without rewriting the plate.",
  },
};

class StoppedError extends Error {}

function roundCost(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function quote(modelKey: ModelKey, archetype: Archetype) {
  const video = roundCost(MODELS[modelKey].cost_per_second_usd * DURATION_SECONDS);
  const startFrame = archetype === "growth_reveal" ? START_FRAME_COST_USD : 0;
  return {
    video_usd: video,
    start_frame_usd: startFrame,
    total_usd: roundCost(video + startFrame),
  };
}

function buildPrompt(archetype: Archetype, plantName: string): string {
  const shared =
    "Preserve the exact species, central specimen identity, black archival background, page borders, typography, labels, measurement marks, and side diagrams. " +
    "All printed text and diagrams remain perfectly still and readable. Do not invent or rewrite text. No extra plants, hands, people, logos, camera shake, cuts, or subject morphing.";

  if (archetype === "growth_reveal") {
    return `Locked-camera botanical time-lapse of ${plantName}. Begin on the provided seed-stage plate. Animate only plausible biological growth: germination, a stem emerging, leaves unfurling, and the mature specimen developing naturally into the exact provided final frame. ${shared} Finish exactly on the supplied last frame and hold in complete stillness.`;
  }
  if (archetype === "living_specimen") {
    return `Bring the ${plantName} specimen almost imperceptibly to life. Leaves and stems respond to one soft breath of air, tendrils slowly curl, and a few tiny pollen or dust particles drift through the light. Camera remains locked. Motion is calm, botanical, photoreal, and physically plausible. ${shared} End close to the original pose and hold.`;
  }
  return `Treat this ${plantName} plate as a priceless museum specimen under glass. Keep the camera locked while a narrow warm examination light travels slowly across only the central plant, revealing surface texture and casting a restrained moving shadow. A few fine archival dust motes drift in the light. ${shared} No zoom, pan, rotation, or animated writing. End on the original lighting.`;
}

function buildStartFramePrompt(plantName: string): string {
  return `Edit this exact vertical botanical plate into a matching seed-stage first frame for a growth time-lapse of ${plantName}. Preserve the entire black background, crop, borders, typography, labels, measurement lines, scientific diagrams, and page layout in their exact original positions. Replace only the mature central plant specimen with one small botanically plausible seed at a thin soil line and the first tiny emerging sprout. Match the original museum-photograph lighting, muted green palette, realism, and engraving aesthetic. Do not add, remove, rewrite, or distort any printed text or diagram.`;
}

function publicJob(job: Record<string, unknown> | null) {
  if (!job) return null;
  return {
    id: job.id,
    animation_row_id: job.animation_row_id,
    still_index: job.still_index,
    still_url: job.still_url,
    archetype: job.archetype,
    model_key: job.model_key,
    model: job.model,
    duration_seconds: job.duration_seconds,
    resolution: job.resolution,
    prompt_version: job.prompt_version,
    prompt: job.prompt,
    status: job.status,
    provider_status: job.provider_status,
    estimated_cost_usd: Number(job.estimated_cost_usd ?? 0),
    pricing_version: job.pricing_version,
    start_frame_url: job.start_frame_url,
    output_url: job.output_url,
    stop_requested_at: job.stop_requested_at,
    error: job.error,
    created_at: job.created_at,
    updated_at: job.updated_at,
    completed_at: job.completed_at,
  };
}

async function cancelPrediction(predictionId: string, replicateKey: string) {
  const response = await fetch(`${GATEWAY}/predictions/${predictionId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${replicateKey}`,
    },
  });
  return { ok: response.ok, status: response.status, body: await response.text().catch(() => "") };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });
  const cors = corsHeadersFor(req);
  const auth = await requireAuthorized(req);
  if (!auth.ok) return auth.response;
  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "options";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const REPLICATE_KEY = Deno.env.get("REPLICATE_API_KEY") ?? "";
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  if (action === "options") {
    return json({
      pricing_version: PRICING_VERSION,
      prompt_version: PROMPT_VERSION,
      duration_seconds: DURATION_SECONDS,
      start_frame: { model: START_FRAME_MODEL, cost_usd: START_FRAME_COST_USD },
      models: Object.entries(MODELS).map(([key, value]) => ({
        key,
        ...value,
        five_second_cost_usd: quote(key as ModelKey, "living_specimen").video_usd,
      })),
      archetypes: Object.entries(ARCHETYPES).map(([key, value]) => ({ key, ...value })),
    });
  }

  if (action === "status") {
    let query = supabase.from("animation_prompt_lab_jobs").select("*");
    if (body?.job_id) query = query.eq("id", body.job_id);
    else if (body?.animation_row_id) query = query.eq("animation_row_id", body.animation_row_id);
    else return json({ error: "job_id or animation_row_id required" }, 400);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    return json({ job: publicJob(data) });
  }

  if (action === "stop") {
    const jobId = typeof body?.job_id === "string" ? body.job_id : "";
    if (!jobId) return json({ error: "job_id required" }, 400);
    const { data: job } = await supabase.from("animation_prompt_lab_jobs").select("*").eq("id", jobId).maybeSingle();
    if (!job) return json({ error: "Prompt Lab job not found" }, 404);
    if (["succeeded", "failed", "canceled"].includes(job.status)) {
      return json({ job: publicJob(job), canceled: [], failed_to_cancel: [] });
    }

    const now = new Date().toISOString();
    await supabase.from("animation_prompt_lab_jobs").update({
      stop_requested_at: now,
      status: "canceled",
      error: "Stopped by user",
      updated_at: now,
      completed_at: now,
    }).eq("id", jobId);
    await supabase.from("cost_events").update({ status: "canceled" }).eq("provider_job_id", jobId);

    const ids = [job.start_frame_prediction_id, job.video_prediction_id].filter(Boolean) as string[];
    const canceled: string[] = [];
    const failed: Array<{ prediction_id: string; reason: string }> = [];
    for (const predictionId of ids) {
      if (!REPLICATE_KEY) {
        failed.push({ prediction_id: predictionId, reason: "provider credentials unavailable" });
        continue;
      }
      const result = await cancelPrediction(predictionId, REPLICATE_KEY).catch((error) => ({
        ok: false,
        status: 0,
        body: error instanceof Error ? error.message : String(error),
      }));
      if (result.ok) canceled.push(predictionId);
      else failed.push({ prediction_id: predictionId, reason: `HTTP ${result.status}: ${result.body.slice(0, 160)}` });
    }
    const { data: stopped } = await supabase.from("animation_prompt_lab_jobs").select("*").eq("id", jobId).single();
    return json({ job: publicJob(stopped), canceled, failed_to_cancel: failed });
  }

  if (action !== "start") return json({ error: "Unknown action" }, 400);
  if (!REPLICATE_KEY) return json({ error: "REPLICATE_API_KEY is not configured" }, 503);

  const animationRowId = typeof body?.animation_row_id === "string" ? body.animation_row_id : "";
  const stillIndex = Number(body?.still_index);
  const archetype = body?.archetype as Archetype;
  const modelKey = body?.model_key as ModelKey;
  const idempotencyKey = typeof body?.idempotency_key === "string" ? body.idempotency_key : "";
  const confirmedEstimate = body?.confirmed_estimate_usd;
  const clientPricingVersion = body?.pricing_version;

  if (!animationRowId || !Number.isInteger(stillIndex) || stillIndex < 0 || stillIndex > 5 || !idempotencyKey) {
    return json({ error: "animation_row_id, still_index, and idempotency_key are required" }, 400);
  }
  if (!(archetype in ARCHETYPES) || !(modelKey in MODELS)) return json({ error: "Invalid archetype or model" }, 400);
  if (archetype === "growth_reveal" && !MODELS[modelKey].supports_last_frame) {
    return json({ error: "Growth Reveal requires a model with final-frame guidance" }, 400);
  }
  const expected = quote(modelKey, archetype);
  if (
    clientPricingVersion !== PRICING_VERSION ||
    typeof confirmedEstimate !== "number" ||
    !Number.isFinite(confirmedEstimate) ||
    Math.abs(confirmedEstimate - expected.total_usd) >= 0.0001
  ) {
    return json({
      error: "cost_confirmation_required",
      pricing_version: PRICING_VERSION,
      expected_total_usd: expected.total_usd,
      breakdown: expected,
    }, 402);
  }

  const { data: animated } = await supabase
    .from("botanical_animated")
    .select("id, plant_name, still_urls")
    .eq("id", animationRowId)
    .maybeSingle();
  const stillUrl = animated?.still_urls?.[stillIndex];
  if (!animated || typeof stillUrl !== "string" || !stillUrl) return json({ error: "Selected still not found" }, 404);

  const model = MODELS[modelKey];
  const prompt = buildPrompt(archetype, animated.plant_name ?? "the selected plant");
  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("animation_prompt_lab_jobs")
    .insert({
      animation_row_id: animationRowId,
      idempotency_key: idempotencyKey,
      still_index: stillIndex,
      still_url: stillUrl,
      archetype,
      model_key: modelKey,
      model: model.model,
      duration_seconds: DURATION_SECONDS,
      resolution: model.resolution,
      prompt_version: PROMPT_VERSION,
      prompt,
      status: "queued",
      estimated_cost_usd: expected.total_usd,
      pricing_version: PRICING_VERSION,
      cost_confirmed_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (insertError) {
    const { data: duplicate } = await supabase
      .from("animation_prompt_lab_jobs")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (duplicate) return json({ success: true, idempotent_replay: true, job: publicJob(duplicate) }, 200);
    const { data: active } = await supabase
      .from("animation_prompt_lab_jobs")
      .select("*")
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (active) return json({ error: "prompt_lab_job_active", active_job: publicJob(active) }, 409);
    return json({ error: insertError.message }, 500);
  }

  const jobId = inserted.id as string;
  await supabase.from("cost_events").insert({
    animated_id: animationRowId,
    provider: "replicate",
    model: model.model,
    operation: `prompt_lab:${archetype}`,
    estimated_cost_usd: expected.total_usd,
    status: "confirmed",
    provider_job_id: jobId,
  });
  const update = async (patch: Record<string, unknown>) => {
    const { error } = await supabase
      .from("animation_prompt_lab_jobs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    if (error) throw new Error(`Prompt Lab state update failed: ${error.message}`);
  };
  const checkStopped = async () => {
    const { data } = await supabase.from("animation_prompt_lab_jobs").select("stop_requested_at, status").eq("id", jobId).maybeSingle();
    if (!data || data.stop_requested_at || data.status === "canceled") throw new StoppedError("stopped");
  };
  const createPrediction = async (providerModel: string, input: Record<string, unknown>) => {
    const response = await fetch(`${GATEWAY}/models/${providerModel}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    });
    if (!response.ok) throw new Error(`Replicate submit failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
    const prediction = await response.json();
    if (typeof prediction?.id !== "string" || !prediction.id) throw new Error("Replicate returned no prediction ID");
    return prediction.id as string;
  };
  const recordSubmittedPrediction = async (
    field: "start_frame_prediction_id" | "video_prediction_id",
    predictionId: string,
    activePatch: Record<string, unknown>,
  ) => {
    // Persist the provider ID only while the job remains active. If Stop won
    // the race, persist the ID without reviving the job, then cancel it here.
    const { data: activeRow, error } = await supabase
      .from("animation_prompt_lab_jobs")
      .update({ [field]: predictionId, ...activePatch, updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .is("stop_requested_at", null)
      .neq("status", "canceled")
      .select("id")
      .maybeSingle();
    const { data: current } = await supabase
      .from("animation_prompt_lab_jobs")
      .select("stop_requested_at, status")
      .eq("id", jobId)
      .maybeSingle();
    if (!error && activeRow && current && !current.stop_requested_at && current.status !== "canceled") return;
    if (!current?.stop_requested_at && current?.status !== "canceled") {
      await cancelPrediction(predictionId, REPLICATE_KEY).catch(() => null);
      throw new Error(`Prediction tracking failed: ${error?.message ?? "job is no longer active"}`);
    }

    await supabase
      .from("animation_prompt_lab_jobs")
      .update({ [field]: predictionId, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    await cancelPrediction(predictionId, REPLICATE_KEY).catch(() => null);
    throw new StoppedError("stopped immediately after provider submission");
  };
  const pollPrediction = async (predictionId: string) => {
    for (let attempt = 0; attempt < 180; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await checkStopped();
      const response = await fetch(`${GATEWAY}/predictions/${predictionId}`, {
        headers: { Authorization: `Bearer ${REPLICATE_KEY}` },
      });
      if (!response.ok) continue;
      const prediction = await response.json();
      await update({ provider_status: prediction.status ?? null });
      if (prediction.status === "succeeded") {
        const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        if (typeof output !== "string" || !output) throw new Error("Replicate returned no output URL");
        return output;
      }
      if (prediction.status === "failed" || prediction.status === "canceled") {
        throw new Error(`Replicate ${prediction.status}: ${prediction.error ?? "unknown provider error"}`);
      }
    }
    throw new Error("Provider polling timed out. The prediction ID remains stored for audit and cancellation.");
  };
  const persistOutput = async (sourceUrl: string, path: string, contentType: string) => {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`Provider output download failed (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const { error } = await supabase.storage.from("botanical-faceless-visuals").upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(`Output upload failed: ${error.message}`);
    return supabase.storage.from("botanical-faceless-visuals").getPublicUrl(path).data.publicUrl;
  };

  const run = async () => {
    try {
      await supabase.from("cost_events").update({ status: "submitted" }).eq("provider_job_id", jobId);
      let firstFrame = stillUrl;
      if (archetype === "growth_reveal") {
        await checkStopped();
        await update({ status: "preparing_start_frame", provider_status: "submitting", error: null });
        const startPredictionId = await createPrediction(START_FRAME_MODEL, {
          prompt: buildStartFramePrompt(animated.plant_name ?? "the selected plant"),
          input_images: [stillUrl],
          aspect_ratio: "9:16",
          quality: "high",
          output_format: "jpeg",
          number_of_images: 1,
        });
        await recordSubmittedPrediction("start_frame_prediction_id", startPredictionId, { provider_status: "starting" });
        await checkStopped();
        const generatedStart = await pollPrediction(startPredictionId);
        firstFrame = await persistOutput(generatedStart, `animated-prompt-lab/${jobId}/start-frame.jpg`, "image/jpeg");
        await update({ start_frame_url: firstFrame, provider_status: "start_frame_ready" });
      }

      await checkStopped();
      await update({ status: "submitting_video", provider_status: "submitting", error: null });
      let videoInput: Record<string, unknown>;
      if (modelKey === "kling_standard") {
        videoInput = {
          start_image: firstFrame,
          prompt,
          negative_prompt: "text changes, rewritten labels, warped diagrams, morphing subject, extra plants, hands, people, camera shake, cuts, cartoon, watermark, logo",
          duration: DURATION_SECONDS,
          aspect_ratio: "9:16",
          cfg_scale: 0.5,
          mode: "standard",
        };
      } else {
        videoInput = {
          image: firstFrame,
          ...(archetype === "growth_reveal" ? { last_frame_image: stillUrl } : {}),
          prompt,
          duration: DURATION_SECONDS,
          resolution: model.resolution,
          aspect_ratio: "9:16",
          generate_audio: false,
          ...(modelKey === "seedance_1_5_pro" ? { camera_fixed: true } : {}),
        };
      }
      const videoPredictionId = await createPrediction(model.model, videoInput);
      await recordSubmittedPrediction("video_prediction_id", videoPredictionId, { status: "running", provider_status: "starting" });
      await checkStopped();
      const generatedVideo = await pollPrediction(videoPredictionId);
      const outputUrl = await persistOutput(generatedVideo, `animated-prompt-lab/${jobId}/result.mp4`, "video/mp4");
      await checkStopped();
      const completedAt = new Date().toISOString();
      await update({
        status: "succeeded",
        provider_status: "succeeded",
        output_url: outputUrl,
        error: null,
        completed_at: completedAt,
      });
      await supabase.from("cost_events").update({ status: "succeeded" }).eq("provider_job_id", jobId);
    } catch (error) {
      const stopped = error instanceof StoppedError;
      const completedAt = new Date().toISOString();
      await update({
        status: stopped ? "canceled" : "failed",
        error: stopped ? "Stopped by user" : (error instanceof Error ? error.message : String(error)),
        completed_at: completedAt,
      });
      await supabase.from("cost_events").update({ status: stopped ? "canceled" : "failed" }).eq("provider_job_id", jobId);
    }
  };

  // @ts-expect-error EdgeRuntime is provided by the Supabase runtime.
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    // @ts-expect-error EdgeRuntime is provided by the Supabase runtime.
    EdgeRuntime.waitUntil(run());
  } else {
    run();
  }

  return json({ success: true, job: publicJob(inserted) }, 202);
});
