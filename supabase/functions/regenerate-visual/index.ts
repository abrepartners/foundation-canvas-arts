import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";
import { getReplicateApiKey } from "../_shared/secrets.ts";

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
  provider?: "replicate" | "openai" | null;
}

const HISTORY_CAP = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });

    const corsHeaders = corsHeadersFor(req);
    const __auth = await requireAuthorized(req);
    if (!__auth.ok) return __auth.response;

  try {
    const body = await req.json();
    const {
      content_id,
      moment,
      image_provider,
      action,
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
      if (!currentVisual) throw new Error("Visual slot not found");

      const newHistory: HistoryEntry[] = [];
      // Push currently active into history (if any)
      if (currentVisual.image_url) {
        newHistory.push({
          image_url: currentVisual.image_url,
          prompt: currentVisual.prompt,
          created_at: new Date().toISOString(),
        });
      }
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
      });

      return new Response(
        JSON.stringify({
          success: true,
          image_url: restoreUrl,
          prompt: restorePrompt,
          moment,
          history: newHistory,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // === REGENERATE ACTION (default) ===
    // Default to Replicate Flux 1.1 Pro for photoreal output.
    // Direct Replicate billing: FLUX by default, with gpt-image-2 optional.
    const imageProvider: "replicate" | "openai" =
      image_provider === "openai"
          ? "openai"
          : "replicate";

    const startedAt = currentVisual?.started_at
      ? Date.parse(currentVisual.started_at)
      : 0;
    const isRecentlyGenerating =
      currentVisual?.status === "generating" &&
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

    const resumePredictionId =
      currentVisual?.status === "generating" && currentVisual.prediction_id
        ? currentVisual.prediction_id
        : null;

    const REPLICATE_API_KEY = await getReplicateApiKey();
    if (!REPLICATE_API_KEY) {
      throw new Error(
        "REPLICATE_API_KEY not configured — required for Replicate-hosted image models",
      );
    }

    // Always build a fresh prompt from the current locked style + stored subject.
    const subject = (
      typeof subjectValue === "string" ? subjectValue : ""
    ).trim();
    const finalPrompt = buildPlatePrompt(subject, moment);

    console.log(
      `Regenerating ${moment} for ${content_id} (provider: ${imageProvider})`,
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
    });

    let imageBuffer: Uint8Array;
    let outputExt: "jpg" | "png" = "jpg";
    {
      const GW = "https://api.replicate.com/v1";
      const model =
        imageProvider === "openai"
          ? "openai/gpt-image-2"
          : "black-forest-labs/flux-1.1-pro";
      const input: Record<string, unknown> =
        imageProvider === "openai"
          ? {
              prompt: finalPrompt,
              quality: "high",
              aspect_ratio: "9:16",
              output_format: "jpeg",
            }
          : {
              prompt: finalPrompt,
              aspect_ratio: "9:16",
              output_format: "jpeg",
              safety_tolerance: 2,
            };

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
        await patchVisual({ prediction_id: predId, provider: imageProvider });
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
    let newHistory: HistoryEntry[] = currentVisual?.history ?? [];
    if (currentVisual?.image_url) {
      newHistory = [
        {
          image_url: currentVisual.image_url,
          prompt: currentVisual.prompt,
          created_at: new Date().toISOString(),
        },
        ...newHistory,
      ].slice(0, HISTORY_CAP);
    }

    await patchVisual({
      image_url: publicUrl,
      prompt: finalPrompt,
      error: null,
      history: newHistory,
      status: "done",
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        image_url: publicUrl,
        moment,
        prompt: finalPrompt,
        history: newHistory,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in regenerate-visual:", message);
    // Best-effort: clear the "generating" flag so the UI re-enables the button.
    try {
      const body = await req.clone().json().catch(() => ({}));
      const errMoment = body?.moment;
      const errContentId = body?.content_id;
      const errTable =
        body?.table === "trend_content" ? "trend_content" : "botanical_content";
      if (errMoment && errContentId) {
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
