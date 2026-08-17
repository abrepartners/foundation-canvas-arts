import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "bytedance/seedream-5-pro";
const ESTIMATED_COST_USD = 0.045;
const MAX_DATA_URL_CHARS = 380_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "no-store" },
  });
}

function b64(value: string) {
  const source = atob(value);
  return Uint8Array.from(source, (c) => c.charCodeAt(0));
}

async function secretKey(serviceRoleKey: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(`botanical-studio-secret-store|${serviceRoleKey}`),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function getEnvironment() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Backend unavailable");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("app_secrets")
    .select("ciphertext,iv")
    .eq("name", "REPLICATE_API_KEY")
    .maybeSingle();

  if (error || !data) throw new Error("Replicate token unavailable");

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64(data.iv) },
    await secretKey(serviceRoleKey),
    b64(data.ciphertext),
  );

  return { supabase, replicateToken: dec.decode(plaintext) };
}

function normalizeOutput(output: unknown) {
  if (Array.isArray(output)) return output[0] ?? null;
  return output ?? null;
}

async function syncCostEvent(
  supabase: ReturnType<typeof createClient>,
  prediction: any,
  predictionId: string,
) {
  const nextStatus =
    prediction.status === "succeeded"
      ? "succeeded"
      : prediction.status === "failed"
        ? "failed"
        : prediction.status === "canceled"
          ? "canceled"
          : "submitted";

  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "succeeded") patch.actual_cost_usd = ESTIMATED_COST_USD;
  if (nextStatus === "failed" || nextStatus === "canceled") patch.actual_cost_usd = 0;

  await supabase
    .from("cost_events")
    .update(patch)
    .eq("provider_job_id", predictionId);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "submit";
    const { supabase, replicateToken } = await getEnvironment();

    if (action === "status") {
      const predictionId = String(body?.prediction_id ?? "").trim();
      if (!predictionId) return json({ error: "prediction_id is required" }, 400);

      const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { Authorization: `Bearer ${replicateToken}` },
      });
      const prediction = await response.json().catch(() => ({}));
      if (!response.ok) {
        return json({ error: prediction?.detail ?? prediction?.error ?? `Replicate HTTP ${response.status}` }, 502);
      }

      await syncCostEvent(supabase, prediction, predictionId);
      return json({
        prediction_id: predictionId,
        status: prediction.status,
        output: normalizeOutput(prediction.output),
        error: prediction.error ?? null,
        metrics: prediction.metrics ?? null,
        model: MODEL,
        estimated_cost_usd: ESTIMATED_COST_USD,
      });
    }

    if (action !== "submit") return json({ error: "Invalid action" }, 400);

    const imageDataUrl = String(body?.image_data_url ?? "").trim();
    const prompt = String(body?.prompt ?? "").trim();

    if (!imageDataUrl.startsWith("data:image/")) {
      return json({ error: "A compressed image data URL is required" }, 400);
    }
    if (imageDataUrl.length > MAX_DATA_URL_CHARS) {
      return json({ error: "Input image is too large. Recompress it before submitting." }, 413);
    }
    if (!prompt || prompt.length > 4000) {
      return json({ error: "Prompt must be between 1 and 4000 characters" }, 400);
    }

    const operation = `benchmark:adaptive-reuse:stage1:${crypto.randomUUID()}`;
    const { data: costEvent, error: costError } = await supabase
      .from("cost_events")
      .insert({
        provider: "replicate",
        model: MODEL,
        operation,
        estimated_cost_usd: ESTIMATED_COST_USD,
        status: "confirmed",
      })
      .select("id")
      .single();

    if (costError) throw costError;

    const response = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateToken}`,
        "Content-Type": "application/json",
        "Cancel-After": "5m",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        input: {
          prompt,
          image_input: [imageDataUrl],
          size: "1K",
          aspect_ratio: "match_input_image",
          output_format: "jpeg",
        },
      }),
    });

    const prediction = await response.json().catch(() => ({}));

    if (!response.ok) {
      await supabase
        .from("cost_events")
        .update({ status: "failed", actual_cost_usd: 0 })
        .eq("id", costEvent.id);
      return json({ error: prediction?.detail ?? prediction?.error ?? `Replicate HTTP ${response.status}` }, 502);
    }

    await supabase
      .from("cost_events")
      .update({ status: "submitted", provider_job_id: prediction.id })
      .eq("id", costEvent.id);

    await syncCostEvent(supabase, prediction, prediction.id);

    return json({
      prediction_id: prediction.id,
      status: prediction.status,
      output: normalizeOutput(prediction.output),
      error: prediction.error ?? null,
      metrics: prediction.metrics ?? null,
      model: MODEL,
      estimated_cost_usd: ESTIMATED_COST_USD,
      settings: {
        size: "1K",
        aspect_ratio: "match_input_image",
        output_format: "jpeg",
        outputs: 1,
      },
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
