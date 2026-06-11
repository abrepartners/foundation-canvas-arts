import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Architectural Botanical Study Plate — locked style. Same style across all six plates;
// only the per-moment composition / storytelling purpose changes.
// Mirrors src/lib/architecturalPlate.ts (edge functions may not import from src).
type Moment = "hook" | "dangle_1" | "rehook" | "dangle_2" | "verified_truth" | "close";

const PLATE_STYLE_BLOCK = `ARCHITECTURAL BOTANICAL STUDY PLATE — LOCKED STYLE:
Vertical 9:16 dark mode botanical study plate. Deep charcoal textured paper. Near black parchment background. Fine paper grain. Soft vignette. Cinematic upper left directional lighting. Muted ivory, bone, warm gray, sage, olive, faded green, graphite, and aged natural tones. Realistic botanical or organic specimen illustration. Architectural blueprint layout. Fine graphite construction lines. Measurement brackets. Scientific annotations. Figure labels. Small numeric markers. Subtle museum style serif typography. Premium archival research aesthetic.

AVOID: people, modern elements, neon, cartoon style, bright colors, glossy advertising style, Canva style layouts, white backgrounds, random decorative elements, clutter, and text heavy graphics.`;

const MOMENT_BRIEFS: Record<Moment, string> = {
  hook:
    "MOMENT — HOOK (SHOT TYPE: FULL HERO SPECIMEN): One large complete botanical subject filling most of the vertical frame. Dramatic, mysterious, scroll stopping. This plate CAN show the full subject. Heavy upper left directional light, deep vignette.",
  dangle_1:
    "MOMENT — DANGLE 1 (SHOT TYPE: EXTREME MACRO CLUE ONLY): Do NOT show the full plant or full flower. Show only one tightly cropped detail such as a petal edge, bud texture, seed pod surface, leaf vein, thorn, root fiber, pollen structure, or stem surface. The image must feel incomplete, suspenseful, and partial. Strictly no full specimen visible.",
  rehook:
    "MOMENT — RE-HOOK (SHOT TYPE: DYNAMIC DIAGONAL COMPOSITION): The subject cuts across the frame at a strong diagonal angle, at larger scale than the hook, with higher contrast, deeper shadow, and heavier blueprint measurement brackets and construction lines. Must feel more dramatic and more graphic than the hook.",
  dangle_2:
    "MOMENT — DANGLE 2 (SHOT TYPE: SCIENTIFIC BREAKDOWN PLATE): Do NOT show a normal full specimen. Show cross sections, internal anatomy, magnified tissue panels, cutaway diagrams, detail circles with leader lines, and numeric markers. Investigative and technical feel. Multiple inset panels acceptable.",
  verified_truth:
    "MOMENT — VERIFIED TRUTH (SHOT TYPE: EVIDENCE BOARD LAYOUT): Must include a structured A, B, C, D anatomical row or grouped detail panels of separated specimen parts. Use labeled parts, figure callouts (Fig. 1, Fig. 2), measurement references, and a clean organized reveal. Most credible, research based plate. Not a single hero specimen.",
  close:
    "MOMENT — CLOSE (SHOT TYPE: FINAL MINIMAL ARCHIVE PLATE): One clean centered specimen with significantly more negative space than the other plates, a subtle golden ratio diagram, a small archival footer, and minimal annotations. Calm, premium, resolved, quiet.",
};

const COMPOSITION_VARIETY_RULE =
  "The six images MUST NOT look like six variations of the same full botanical poster. They must share the exact same visual style (paper, palette, typography, blueprint language), but each moment must have a clearly different shot type and composition as specified in its moment brief.";

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
    PLATE_STYLE_BLOCK,
    "",
    MOMENT_BRIEFS[moment],
    "",
    `SUBJECT: ${subj}.`,
    "",
    COMPOSITION_VARIETY_RULE,
    "",
    `Use the exact same Architectural Botanical Study Plate style across all six plates. Only the composition and storytelling purpose change. Subject: ${subj}.`,
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
    const { content_id, moment, image_provider, action, image_url: restoreUrl, prompt: restorePrompt } = body;

    if (!content_id || !moment) {
      throw new Error("Missing required fields: content_id, moment");
    }
    if (!isMoment(moment)) {
      throw new Error(`Invalid moment: ${moment}`);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch current content row
    const { data: contentRow, error: fetchError } = await supabase
      .from("botanical_content")
      .select("script_visuals, plant_name")
      .eq("id", content_id)
      .single();

    if (fetchError || !contentRow) {
      throw new Error("Content not found");
    }

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
          ? { ...v, image_url: restoreUrl, prompt: restorePrompt, error: null, history: newHistory }
          : v
      );

      await supabase
        .from("botanical_content")
        .update({ script_visuals: JSON.stringify(updatedVisuals) })
        .eq("id", content_id);

      return new Response(JSON.stringify({
        success: true,
        image_url: restoreUrl,
        prompt: restorePrompt,
        moment,
        history: newHistory,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === REGENERATE ACTION (default) ===
    const imageProvider: "lovable" | "replicate" =
      image_provider === "replicate" ? "replicate" : "lovable";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (imageProvider === "replicate" && !REPLICATE_API_KEY) {
      throw new Error("Replicate selected but REPLICATE_API_KEY not configured");
    }

    // Always build a fresh prompt from the current locked style + stored plant name.
    const subject = (contentRow.plant_name ?? "").trim();
    const finalPrompt = buildPlatePrompt(subject, moment);

    console.log(`Regenerating ${moment} for ${content_id} (provider: ${imageProvider})`);

    let imageBuffer: Uint8Array;
    if (imageProvider === "replicate") {
      const GW = "https://connector-gateway.lovable.dev/replicate/v1";
      let createRes: Response | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        createRes = await fetch(`${GW}/models/black-forest-labs/flux-1.1-pro/predictions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
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
        });
        if (createRes.status !== 429) break;
        let waitSec = 12;
        try {
          const b = await createRes.clone().json();
          if (typeof b?.retry_after === "number") waitSec = Math.max(b.retry_after + 2, 8);
        } catch { /* ignore */ }
        console.log(`Replicate 429; retrying in ${waitSec}s (attempt ${attempt + 1}/4)`);
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
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
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
      if (!imgRes.ok) throw new Error(`Replicate image fetch failed: ${imgRes.status}`);
      imageBuffer = new Uint8Array(await imgRes.arrayBuffer());
    } else {
      const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [{ role: "user", content: finalPrompt }],
          modalities: ["image", "text"],
        }),
      });
      if (!imageResponse.ok) {
        throw new Error(`Image generation failed: ${imageResponse.status}`);
      }
      const imageData = await imageResponse.json();
      const base64Image = imageData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
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
        ? { ...v, image_url: publicUrl, prompt: finalPrompt, error: null, history: newHistory }
        : v
    );

    const { error: updateError } = await supabase
      .from("botanical_content")
      .update({ script_visuals: JSON.stringify(updatedVisuals) })
      .eq("id", content_id);

    if (updateError) {
      console.error("DB update failed:", updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      image_url: publicUrl,
      moment,
      prompt: finalPrompt,
      history: newHistory,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in regenerate-visual:", message);
    return new Response(JSON.stringify({
      success: false,
      error: message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
