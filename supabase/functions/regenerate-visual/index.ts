import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
}

const HISTORY_CAP = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

      const updatedVisuals = visuals.map((v) =>
        v.moment === moment
          ? {
              ...v,
              image_url: restoreUrl,
              prompt: restorePrompt,
              error: null,
              history: newHistory,
            }
          : v,
      );

      await supabase
        .from(table)
        .update({ script_visuals: JSON.stringify(updatedVisuals) })
        .eq("id", content_id);

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
    // Only fall back to Lovable Gemini if explicitly requested.
    const imageProvider: "lovable" | "replicate" =
      image_provider === "lovable" ? "lovable" : "replicate";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (imageProvider === "replicate" && !REPLICATE_API_KEY) {
      throw new Error(
        "REPLICATE_API_KEY not configured — required for photoreal Flux rendering",
      );
    }

    // Always build a fresh prompt from the current locked style + stored plant name.
    const subject = (contentRow.plant_name ?? "").trim();
    const finalPrompt = buildPlatePrompt(subject, moment);

    console.log(
      `Regenerating ${moment} for ${content_id} (provider: ${imageProvider})`,
    );

    let imageBuffer: Uint8Array;
    if (imageProvider === "replicate") {
      const GW = "https://connector-gateway.lovable.dev/replicate/v1";
      let createRes: Response | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        createRes = await fetch(
          `${GW}/models/black-forest-labs/flux-1.1-pro/predictions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": REPLICATE_API_KEY!,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                prompt: finalPrompt,
                aspect_ratio: "9:16",
                output_format: "png",
                safety_tolerance: 2,
              },
            }),
          },
        );
        if (createRes.status !== 429) break;
        let waitSec = 12;
        try {
          const b = await createRes.clone().json();
          if (typeof b?.retry_after === "number")
            waitSec = Math.max(b.retry_after + 2, 8);
        } catch {
          /* ignore */
        }
        console.log(
          `Replicate 429; retrying in ${waitSec}s (attempt ${attempt + 1}/4)`,
        );
        await new Promise((r) => setTimeout(r, waitSec * 1000));
      }
      if (!createRes || !createRes.ok) {
        const txt = createRes ? await createRes.text() : "no response";
        throw new Error(`Replicate create failed: ${createRes?.status} ${txt}`);
      }
      const pred = await createRes.json();
      const predId = pred.id;
      let outputUrl: string | null = null;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, i < 5 ? 2000 : 4000));
        const pollRes = await fetch(`${GW}/predictions/${predId}`, {
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": REPLICATE_API_KEY!,
          },
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
    } else {
      const imageResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [{ role: "user", content: finalPrompt }],
            modalities: ["image", "text"],
          }),
        },
      );
      if (!imageResponse.ok) {
        throw new Error(`Image generation failed: ${imageResponse.status}`);
      }
      const imageData = await imageResponse.json();
      const base64Image =
        imageData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!base64Image || typeof base64Image !== "string") {
        throw new Error("No image data received from AI");
      }
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
      imageBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    }

    // Versioned storage path so previous renders remain reachable.
    const timestamp = Date.now();
    const filePath = `${content_id}/${moment}/${timestamp}.png`;

    const { error: uploadError } = await supabase.storage
      .from("botanical-faceless-visuals")
      .upload(filePath, imageBuffer, {
        contentType: "image/png",
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

    const updatedVisuals = visuals.map((v) =>
      v.moment === moment
        ? {
            ...v,
            image_url: publicUrl,
            prompt: finalPrompt,
            error: null,
            history: newHistory,
          }
        : v,
    );

    const { error: updateError } = await supabase
      .from("botanical_content")
      .update({ script_visuals: JSON.stringify(updatedVisuals) })
      .eq("id", content_id);

    if (updateError) {
      console.error("DB update failed:", updateError);
    }

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
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
