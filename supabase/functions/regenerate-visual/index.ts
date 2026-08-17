import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";
import { getReplicateApiKey } from "../_shared/secrets.ts";
import {
  STILL_DAILY_LIMIT_USD,
  STILL_PER_RUN_LIMIT_USD,
  STILL_PROMPT_VERSION,
  stillImageQuote,
  type StillImageModel,
  type StillImageProvider,
} from "../_shared/pricing.ts";

// Architectural Botanical Study Plate — locked style. Same style across all six plates;
// only the per-moment composition / storytelling purpose changes.
// Mirrors src/lib/architecturalPlate.ts (edge functions may not import from src).
type Moment =
  | "hook"
  | "dangle_1"
  | "rehook"
  | "dangle_2"
  | "verified_truth"
  | "close";

const PLATE_STYLE_BLOCK =
  "Dark charcoal textured paper, near-black parchment, fine grain, soft vignette, cinematic upper-left lighting, muted ivory, bone, warm gray, sage, olive, faded green, and graphite palette. Realistic botanical specimen with museum-grade depth and texture. Architectural blueprint layout with thin construction lines, measurement brackets, scientific annotations, figure labels, and small numeric markers.";

const PLATE_AVOID_LINE =
  "Avoid people, modern objects, neon, cartoon style, bright colors, glossy ad style, Canva layouts, white backgrounds, clutter, text-heavy graphics, flat sketches, wireframe-only specimens, and line-art-only flowers or leaves.";

const PLATE_QUALITY_LINE =
  "High-detail editorial botanical plate, premium archival research aesthetic, photorealistic specimen with true texture and depth, 9:16 vertical.";

const PLATE_CONSISTENCY_LINE =
  "Use the same Architectural Botanical Study Plate style across all six plates. Only the composition and storytelling purpose change.";

const MOMENT_BRIEFS: Record<Moment, string> = {
  hook: "Full hero specimen shot from a low camera angle looking slightly up, one large complete botanical subject filling the frame and emerging from darkness. Dramatic, mysterious, scroll-stopping.",
  dangle_1:
    "Extreme macro photograph, camera inches from the surface with shallow depth of field. One cropped detail only, such as petal edge, bud texture, seed pod, leaf vein, thorn, root fiber, or stem surface. Never the full plant. Incomplete and suspenseful.",
  rehook:
    "Hard diagonal composition, the specimen slashes corner to corner across the frame at a steep 45-degree angle, larger than life scale, deep shadows, high contrast. The most dramatic plate, but still archival.",
  dangle_2:
    "Overhead dissection table, top-down flat lay of cross sections, split-open specimen halves, internal anatomy, magnified tissue circles, and numeric markers. No whole intact specimen. Investigative and technical.",
  verified_truth:
    "Organized evidence board, top-down view of separated specimen parts laid out in a clean labeled A, B, C, D row: petal, stem segment, bud, leaf, seed, with figure callouts and measurement references. Most structured and credible plate.",
  close:
    "Final minimal archive plate, one small clean specimen centered with generous negative space around it, subtle golden-ratio diagram, small archival footer, minimal annotations. Calm, premium, resolved.",
};

const MOMENT_NAMES: Record<Moment, string> = {
  hook: "Hook",
  dangle_1: "Dangle 1",
  rehook: "Re-hook",
  dangle_2: "Dangle 2",
  verified_truth: "Verified Truth",
  close: "Close",
};

function isMoment(v: unknown): v is Moment {
  return (
    v === "hook" ||
    v === "dangle_1" ||
    v === "rehook" ||
    v === "dangle_2" ||
    v === "verified_truth" ||
    v === "close"
  );
}

function buildPlatePrompt(subject: string, moment: Moment): string {
  const subj = subject.trim() || "the selected botanical subject";
  return [
    `Subject: ${subj}`,
    "",
    `Create a vertical 9:16 Architectural Botanical Study Plate of ${subj}. ${PLATE_STYLE_BLOCK}`,
    "",
    `Moment: ${MOMENT_NAMES[moment]}`,
    MOMENT_BRIEFS[moment],
    "",
    PLATE_AVOID_LINE,
    "",
    PLATE_QUALITY_LINE,
    "",
    PLATE_CONSISTENCY_LINE,
  ].join("\n");
}

interface HistoryEntry {
  image_url: string;
  prompt: string;
  created_at: string;
  provider?: StillImageProvider | null;
  model?: StillImageModel | null;
  model_version?: string | null;
  prompt_version?: string | null;
  settings?: Record<string, unknown> | null;
  seed?: number | null;
}

interface Visual {
  moment: string;
  prompt: string;
  image_url?: string | null;
  error?: string | null;
  history?: HistoryEntry[];
  status?: "queued" | "generating" | "done" | "error";
  started_at?: string | null;
  completed_at?: string | null;
  prediction_id?: string | null;
  provider?: StillImageProvider | null;
  model?: StillImageModel | null;
  model_version?: string | null;
  prompt_version?: string | null;
  settings?: Record<string, unknown> | null;
  seed?: number | null;
}

interface RegenerateRequestBody {
  content_id?: string;
  moment?: Moment | string;
  image_provider?: StillImageProvider;
  action?: "quote" | "restore" | string;
  prompt_mode?: "saved" | "refresh";
  cost_confirmation?: {
    idempotency_key?: string;
    pricing_version?: string;
    estimated_cost_usd?: number;
    prompt_fingerprint?: string;
  };
  image_url?: string;
  prompt?: string;
  table?: "botanical_content" | "trend_content";
  storage_prefix?: string;
}

const HISTORY_CAP = 5;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isStillImageModel(value: unknown): value is StillImageModel {
  return value === "black-forest-labs/flux-1.1-pro" || value === "openai/gpt-image-2";
}

function resolveModel(visual: Visual): StillImageModel {
  if (isStillImageModel(visual.model)) return visual.model;
  return visual.provider === "openai"
    ? "openai/gpt-image-2"
    : "black-forest-labs/flux-1.1-pro";
}

function defaultSettings(model: StillImageModel): Record<string, unknown> {
  return model === "openai/gpt-image-2"
    ? {
        quality: "high",
        aspect_ratio: "9:16",
        output_format: "jpeg",
      }
    : {
        aspect_ratio: "9:16",
        output_format: "jpeg",
        safety_tolerance: 2,
        prompt_upsampling: false,
      };
}

function resolveSettings(visual: Visual, model: StillImageModel): Record<string, unknown> {
  const saved = visual.settings;
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    return defaultSettings(model);
  }

  const allowed = model === "openai/gpt-image-2"
    ? ["quality", "aspect_ratio", "output_format"]
    : ["aspect_ratio", "output_format", "safety_tolerance", "prompt_upsampling", "seed"];
  const resolved = defaultSettings(model);
  for (const key of allowed) {
    if (saved[key] !== undefined) resolved[key] = saved[key];
  }
  return resolved;
}

function historyEntry(visual: Visual): HistoryEntry | null {
  if (!visual.image_url) return null;
  return {
    image_url: visual.image_url,
    prompt: visual.prompt,
    created_at: new Date().toISOString(),
    provider: visual.provider ?? null,
    model: isStillImageModel(visual.model) ? visual.model : resolveModel(visual),
    model_version: visual.model_version ?? null,
    prompt_version: visual.prompt_version ?? null,
    settings: visual.settings ?? null,
    seed: visual.seed ?? null,
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableStringify(record[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function regenerationFingerprint(input: {
  contentId: string;
  moment: Moment;
  model: StillImageModel;
  prompt: string;
  promptVersion: string;
  settings: Record<string, unknown>;
}): Promise<string> {
  const encoded = new TextEncoder().encode(stableStringify(input));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function centralDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });

    const corsHeaders = corsHeadersFor(req);
    const __auth = await requireAuthorized(req);
    if (!__auth.ok) return __auth.response;

  let requestBody: RegenerateRequestBody = {};
  let generationStarted = false;
  let costContext: { contentId: string; operation: string } | null = null;
  try {
    requestBody = await req.json() as RegenerateRequestBody;
    const body = requestBody;
    const {
      content_id,
      moment,
      image_provider,
      action,
      prompt_mode: promptModeInput,
      cost_confirmation: costConfirmation,
      image_url: restoreUrl,
      prompt: restorePrompt,
      table: tableInput,
      storage_prefix: storagePrefixInput,
    } = body;

    if (!content_id || !moment) {
      throw new Error("Missing required fields: content_id, moment");
    }
    if (!isMoment(moment)) {
      throw new Error(`Invalid moment: ${moment}`);
    }

    const table: "botanical_content" | "trend_content" =
      tableInput === "trend_content" ? "trend_content" : "botanical_content";
    const subjectColumn = table === "trend_content" ? "subject" : "plant_name";
    const storagePrefix =
      typeof storagePrefixInput === "string" && storagePrefixInput.length > 0
        ? storagePrefixInput.replace(/^\/+|\/+$/g, "")
        : table === "trend_content"
          ? "trends"
          : "";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch current content row
    const { data: contentRow, error: fetchError } = await supabase
      .from(table)
      .select(`script_visuals, ${subjectColumn}`)
      .eq("id", content_id)
      .single();

    if (fetchError || !contentRow) {
      throw new Error("Content not found");
    }
    const subjectValue = (contentRow as Record<string, unknown>)[subjectColumn];

    let visuals: Visual[] = [];
    try {
      visuals = JSON.parse(contentRow.script_visuals || "[]");
    } catch {
      visuals = [];
    }

    const currentVisual = visuals.find((v) => v.moment === moment);
    if (!currentVisual) throw new Error("Visual slot not found");

    const patchVisual = async (patch: Partial<Visual>) => {
      if (table === "botanical_content") {
        const { error: patchError } = await supabase.rpc("patch_botanical_visual", {
          _content_id: content_id,
          _moment: moment,
          _patch: patch,
        });
        if (patchError) throw new Error(`visual status update failed: ${patchError.message}`);
        return;
      }

      const { data: latest } = await supabase
        .from(table)
        .select("script_visuals")
        .eq("id", content_id)
        .single();
      let current: Visual[] = visuals;
      try {
        current = typeof latest?.script_visuals === "string"
          ? JSON.parse(latest.script_visuals)
          : latest?.script_visuals ?? visuals;
      } catch {
        current = visuals;
      }
      const next = current.map((visual) =>
        visual.moment === moment ? { ...visual, ...patch } : visual
      );
      const { error: updateError } = await supabase
        .from(table)
        .update({ script_visuals: JSON.stringify(next) })
        .eq("id", content_id);
      if (updateError) throw new Error(`visual status update failed: ${updateError.message}`);
    };

    // === RESTORE ACTION: swap current with a history entry ===
    if (action === "restore") {
      if (!restoreUrl || !restorePrompt) {
        throw new Error("restore action requires image_url and prompt");
      }
      const restoredEntry = (currentVisual.history ?? []).find(
        (entry) => entry.image_url === restoreUrl && entry.prompt === restorePrompt,
      );
      if (!restoredEntry) throw new Error("The selected history version no longer exists");

      const newHistory: HistoryEntry[] = [];
      // Push currently active into history (if any)
      const activeEntry = historyEntry(currentVisual);
      if (activeEntry) newHistory.push(activeEntry);
      // Add the remaining history minus the entry we're restoring
      for (const h of currentVisual.history ?? []) {
        if (h.image_url !== restoreUrl) newHistory.push(h);
        if (newHistory.length >= HISTORY_CAP) break;
      }

      await patchVisual({
        image_url: restoreUrl,
        prompt: restorePrompt,
        error: null,
        history: newHistory,
        status: "done",
        completed_at: new Date().toISOString(),
        prediction_id: null,
        provider: restoredEntry.provider ?? currentVisual.provider ?? null,
        model: restoredEntry.model ?? currentVisual.model ?? null,
        model_version: restoredEntry.model_version ?? null,
        prompt_version: restoredEntry.prompt_version ?? currentVisual.prompt_version ?? null,
        settings: restoredEntry.settings ?? currentVisual.settings ?? null,
        seed: restoredEntry.seed ?? null,
      });

      return new Response(
        JSON.stringify({
          success: true,
          image_url: restoreUrl,
          prompt: restorePrompt,
          moment,
          history: newHistory,
          provider: restoredEntry.provider ?? currentVisual.provider ?? null,
          model: restoredEntry.model ?? currentVisual.model ?? null,
          model_version: restoredEntry.model_version ?? null,
          prompt_version: restoredEntry.prompt_version ?? currentVisual.prompt_version ?? null,
          settings: restoredEntry.settings ?? currentVisual.settings ?? null,
          seed: restoredEntry.seed ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // The saved image record is authoritative. The request cannot silently
    // switch an existing slot to another provider, model, prompt, or settings.
    // image_provider remains a legacy fallback only for old trend rows that do
    // not contain provider metadata.
    const legacyVisual: Visual = currentVisual.provider || currentVisual.model
      ? currentVisual
      : { ...currentVisual, provider: image_provider === "openai" ? "openai" : "replicate" };
    const model = resolveModel(legacyVisual);
    const resumePredictionId =
      currentVisual.status === "generating" && currentVisual.prediction_id
        ? currentVisual.prediction_id
        : null;
    const baseQuote = stillImageQuote(model);
    const quote = resumePredictionId
      ? { ...baseQuote, image_unit_usd: 0, estimated_cost_usd: 0, resumes_existing_job: true }
      : { ...baseQuote, resumes_existing_job: false };
    const imageProvider = quote.image_provider;
    const promptMode = promptModeInput === "refresh" ? "refresh" : "saved";
    const subject = (typeof subjectValue === "string" ? subjectValue : "").trim();
    const storedPrompt = typeof currentVisual.prompt === "string"
      ? currentVisual.prompt.trim()
      : "";
    const finalPrompt = promptMode === "refresh" || !storedPrompt
      ? buildPlatePrompt(subject, moment)
      : currentVisual.prompt;
    const promptVersion = promptMode === "refresh"
      ? STILL_PROMPT_VERSION
      : currentVisual.prompt_version ?? "legacy-saved-prompt";
    const settings = resolveSettings(currentVisual, model);
    const input = { ...settings, prompt: finalPrompt };
    const fingerprint = await regenerationFingerprint({
      contentId: content_id,
      moment,
      model,
      prompt: finalPrompt,
      promptVersion,
      settings,
    });

    const startedAt = currentVisual.started_at ? Date.parse(currentVisual.started_at) : 0;
    const isRecentlyGenerating =
      currentVisual.status === "generating" &&
      startedAt > 0 &&
      Date.now() - startedAt < 10 * 60_000;
    if (isRecentlyGenerating) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "This image is already generating. Wait for it to finish before retrying.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: recentCosts, error: costsError } = table === "botanical_content"
      ? await supabase
        .from("cost_events")
        .select("estimated_cost_usd,actual_cost_usd,status,created_at")
        .gte("created_at", new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString())
      : { data: [], error: null };
    if (costsError) throw costsError;
    const today = centralDate(new Date());
    const dailyReserved = (recentCosts ?? [])
      .filter((entry) =>
        centralDate(entry.created_at) === today &&
        ["confirmed", "submitted", "succeeded"].includes(entry.status)
      )
      .reduce(
        (sum, entry) => sum + Number(entry.actual_cost_usd ?? entry.estimated_cost_usd ?? 0),
        0,
      );

    if (action === "quote") {
      return new Response(
        JSON.stringify({
          success: true,
          quote: {
            ...quote,
            moment,
            prompt_mode: promptMode,
            prompt_version: promptVersion,
            prompt_fingerprint: fingerprint,
            settings,
            idempotency_key: crypto.randomUUID(),
            daily_reserved_usd: +dailyReserved.toFixed(4),
            daily_remaining_usd: +Math.max(0, STILL_DAILY_LIMIT_USD - dailyReserved).toFixed(4),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let regenerationOperation: string | null = null;
    if (table === "botanical_content") {
      const idempotencyKey = typeof costConfirmation?.idempotency_key === "string"
        ? costConfirmation.idempotency_key
        : "";
      const pricingVersion = typeof costConfirmation?.pricing_version === "string"
        ? costConfirmation.pricing_version
        : "";
      const confirmedEstimate = Number(costConfirmation?.estimated_cost_usd);
      const confirmedFingerprint = typeof costConfirmation?.prompt_fingerprint === "string"
        ? costConfirmation.prompt_fingerprint
        : "";
      if (
        !UUID_PATTERN.test(idempotencyKey) ||
        pricingVersion !== quote.pricing_version ||
        !Number.isFinite(confirmedEstimate) ||
        Math.abs(confirmedEstimate - quote.estimated_cost_usd) > 0.0001 ||
        confirmedFingerprint !== fingerprint
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            error_code: "COST_CONFIRMATION_REQUIRED",
            error: "Review and confirm the current image regeneration cost before starting.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (quote.estimated_cost_usd > STILL_PER_RUN_LIMIT_USD) {
        throw new Error("This regeneration exceeds the $1 per-run limit");
      }
      if (dailyReserved + quote.estimated_cost_usd > STILL_DAILY_LIMIT_USD) {
        throw new Error("The $5 daily generation limit has been reached");
      }

      const operation = `regenerate:${moment}:${idempotencyKey}`;
      regenerationOperation = operation;
      costContext = { contentId: content_id, operation };
      const { data: existingCost } = await supabase
        .from("cost_events")
        .select("id,status")
        .eq("botanical_content_id", content_id)
        .eq("operation", operation)
        .maybeSingle();
      if (existingCost) {
        return new Response(
          JSON.stringify({
            success: false,
            error_code: "DUPLICATE_REQUEST",
            error: "This regeneration request was already accepted.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { error: costInsertError } = await supabase.from("cost_events").insert({
        botanical_content_id: content_id,
        provider: "replicate",
        model,
        operation,
        estimated_cost_usd: quote.estimated_cost_usd,
        status: "confirmed",
      });
      if (costInsertError) {
        if (costInsertError.code === "23505") {
          return new Response(
            JSON.stringify({
              success: false,
              error_code: "DUPLICATE_REQUEST",
              error: "This regeneration request was already accepted.",
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        throw costInsertError;
      }
    }

    // === REGENERATE ACTION (default) ===

    const REPLICATE_API_KEY = await getReplicateApiKey();
    if (!REPLICATE_API_KEY) {
      throw new Error(
        "REPLICATE_API_KEY not configured — required for Replicate-hosted image models",
      );
    }

    console.log(
      `Regenerating ${moment} for ${content_id} with saved ${model} settings and ${promptMode} prompt`,
    );

    // Mark this slot as generating BEFORE calling the provider so the UI
    // (which polls script_visuals) shows the in-flight state and disables
    // the regenerate button — preventing duplicate credit spend.
    await patchVisual({
      status: "generating",
      error: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      prediction_id: resumePredictionId,
      provider: imageProvider,
      model,
      prompt_version: promptVersion,
      settings,
    });
    generationStarted = true;

    let imageBuffer: Uint8Array;
    let outputExt: "jpg" | "png" = "jpg";
    let modelVersion: string | null = currentVisual.model_version ?? null;
    {
      const GW = "https://api.replicate.com/v1";
      let predId = resumePredictionId;
      if (!predId) {
        const createRes = await fetch(`${GW}/models/${model}/predictions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${REPLICATE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input }),
        });
        if (!createRes.ok) {
          const txt = await createRes.text();
          throw new Error(`Replicate create failed: ${createRes.status} ${txt}`);
        }
        const pred = await createRes.json();
        predId = pred.id;
        if (!predId) throw new Error("Replicate: no prediction id");
        modelVersion = typeof pred.version === "string" ? pred.version : null;
        await patchVisual({
          prediction_id: predId,
          provider: imageProvider,
          model,
          model_version: modelVersion,
          prompt_version: promptVersion,
          settings,
        });
        if (regenerationOperation) {
          await supabase.from("cost_events").update({
            status: "submitted",
            provider_job_id: predId,
          }).eq("botanical_content_id", content_id)
            .eq("operation", regenerationOperation);
        }
      } else {
        console.log(`Resuming Replicate prediction ${predId} for ${moment}`);
      }
      let outputUrl: string | null = null;
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, i < 5 ? 2000 : 4000));
        const pollRes = await fetch(`${GW}/predictions/${predId}`, {
          headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
        });
        if (!pollRes.ok) continue;
        const p = await pollRes.json();
        if (p.status === "succeeded") {
          outputUrl = Array.isArray(p.output) ? p.output[0] : p.output;
          break;
        }
        if (p.status === "failed" || p.status === "canceled") {
          throw new Error(`Replicate prediction ${p.status}: ${p.error ?? ""}`);
        }
      }
      if (!outputUrl) throw new Error("Replicate timed out");
      const imgRes = await fetch(outputUrl);
      if (!imgRes.ok)
        throw new Error(`Replicate image fetch failed: ${imgRes.status}`);
      imageBuffer = new Uint8Array(await imgRes.arrayBuffer());
      outputExt = "jpg";
    }



    // Versioned storage path so previous renders remain reachable.
    // Replicate outputs jpg, which is compatible with the publishing workflow.
    const ext = outputExt;
    const timestamp = Date.now();
    const filePath = storagePrefix
      ? `${storagePrefix}/${content_id}/${moment}/${timestamp}.${ext}`
      : `${content_id}/${moment}/${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("botanical-faceless-visuals")
      .upload(filePath, imageBuffer, {
        contentType: ext === "jpg" ? "image/jpeg" : "image/png",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("botanical-faceless-visuals")
      .getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    // Push currently active render onto history (newest first, cap 5)
    let newHistory: HistoryEntry[] = currentVisual.history ?? [];
    const previousEntry = historyEntry(currentVisual);
    if (previousEntry) {
      newHistory = [previousEntry, ...newHistory].slice(0, HISTORY_CAP);
    }

    await patchVisual({
      image_url: publicUrl,
      prompt: finalPrompt,
      error: null,
      history: newHistory,
      status: "done",
      completed_at: new Date().toISOString(),
      prediction_id: null,
      provider: imageProvider,
      model,
      model_version: modelVersion,
      prompt_version: promptVersion,
      settings,
      seed: typeof settings.seed === "number" ? settings.seed : currentVisual.seed ?? null,
    });

    if (regenerationOperation) {
      await supabase.from("cost_events").update({
        status: "succeeded",
        actual_cost_usd: quote.estimated_cost_usd,
      }).eq("botanical_content_id", content_id)
        .eq("operation", regenerationOperation);
    }

    return new Response(
      JSON.stringify({
        success: true,
        image_url: publicUrl,
        moment,
        prompt: finalPrompt,
        history: newHistory,
        provider: imageProvider,
        model,
        model_version: modelVersion,
        prompt_version: promptVersion,
        settings,
        seed: typeof settings.seed === "number" ? settings.seed : currentVisual.seed ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in regenerate-visual:", message);
    // Best-effort: clear the "generating" flag so the UI re-enables the button.
    try {
      const body = requestBody;
      const errMoment = body?.moment;
      const errContentId = body?.content_id;
      const errTable =
        body?.table === "trend_content" ? "trend_content" : "botanical_content";
      if (generationStarted && errMoment && errContentId) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        );
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          if (errTable === "botanical_content") {
            await sb.rpc("patch_botanical_visual", {
              _content_id: errContentId,
              _moment: errMoment,
              _patch: {
                status: "error",
                error: message.slice(0, 240),
                completed_at: new Date().toISOString(),
              },
            });
          } else {
            const { data: row } = await sb
              .from(errTable)
              .select("script_visuals")
              .eq("id", errContentId)
              .single();
            if (row?.script_visuals) {
              let arr: Visual[] = [];
              try {
                arr = JSON.parse(row.script_visuals);
              } catch {
                /* ignore */
              }
              const next = arr.map((v) =>
                v.moment === errMoment
                  ? {
                      ...v,
                      status: "error" as const,
                      error: message.slice(0, 240),
                      completed_at: new Date().toISOString(),
                    }
                  : v,
              );
              await sb
                .from(errTable)
                .update({ script_visuals: JSON.stringify(next) })
                .eq("id", errContentId);
            }
          }
        }
      }
      if (costContext) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await sb.from("cost_events").update({ status: "failed" })
            .eq("botanical_content_id", costContext.contentId)
            .eq("operation", costContext.operation);
        }
      }
    } catch {
      /* swallow */
    }
    const isCredit = /CREDIT_LIMIT/i.test(message);
    const isRate = /RATE_LIMIT/i.test(message);
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        error_code: isCredit ? "CREDIT_LIMIT" : isRate ? "RATE_LIMIT" : "ERROR",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
