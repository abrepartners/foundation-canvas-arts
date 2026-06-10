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
    "MOMENT — HOOK: Boldest plate. Large hero specimen filling most of the frame. Mysterious, scroll stopping, dramatic upper left light, deep vignette.",
  dangle_1:
    "MOMENT — DANGLE 1: Close up clue. Partial reveal. One isolated detail such as a leaf edge, bud, tendril, root, seed, flower part, fruit surface, or botanical texture cropped tight. Suspenseful. Does not show the whole subject.",
  rehook:
    "MOMENT — RE-HOOK: Second visual punch. Stronger angle, higher contrast, larger scale, more construction lines and brackets framing the specimen.",
  dangle_2:
    "MOMENT — DANGLE 2: Investigative detail. Cross section, anatomy, hidden internal structure, magnified scientific breakdown, measurement brackets, numeric markers.",
  verified_truth:
    "MOMENT — VERIFIED TRUTH: Most credible plate. Organized evidence layout. Labeled A, B, C, D anatomical row. Figure annotations. Clean structured reveal.",
  close:
    "MOMENT — CLOSE: Final archive plate. Calm, resolved, premium, minimal. Single specimen, golden ratio diagram, small archival footer feel.",
};

interface PlateSubject {
  commonName?: string;
  binomial?: string;
  description?: string;
  specimenNote?: string;
}

function subjectToString(subject: PlateSubject): string {
  const parts: string[] = [];
  if (subject.commonName?.trim()) parts.push(subject.commonName.trim());
  if (subject.binomial?.trim()) parts.push(`(${subject.binomial.trim()})`);
  let line = parts.join(" ");
  if (subject.description?.trim()) line += ` — ${subject.description.trim()}`;
  if (subject.specimenNote?.trim()) line += `. Hero specimen: ${subject.specimenNote.trim()}`;
  return line.trim();
}

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
    `Use the exact same Architectural Botanical Study Plate style across all six plates. Only the composition and storytelling purpose change. Subject: ${subj}.`,
  ].join("\n");
}

function composePrompt(subject: PlateSubject, moment: Moment): string {
  return buildPlatePrompt(subjectToString(subject), moment);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content_id, moment, prompt, subject, image_provider } = await req.json();

    if (!content_id || !moment) {
      throw new Error("Missing required fields: content_id, moment");
    }

    const imageProvider: "lovable" | "replicate" =
      image_provider === "replicate" ? "replicate" : "lovable";

    // If a subject is provided, compose a fresh prompt from the locked template.
    // Otherwise, fall back to the prompt sent by the client (legacy behavior).
    const hasSubject =
      subject &&
      typeof subject === "object" &&
      typeof subject.commonName === "string" &&
      subject.commonName.trim().length > 0 &&
      typeof subject.binomial === "string" &&
      subject.binomial.trim().length > 0 &&
      typeof subject.description === "string" &&
      subject.description.trim().length > 0;

    const momentForPrompt: Moment = isMoment(moment) ? moment : "hook";
    const finalPrompt: string = hasSubject
      ? composePrompt(subject as PlateSubject, momentForPrompt)
      : prompt;

    if (!finalPrompt || typeof finalPrompt !== "string") {
      throw new Error("Missing prompt and no valid subject provided");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }
    if (imageProvider === "replicate" && !REPLICATE_API_KEY) {
      throw new Error("Replicate selected but REPLICATE_API_KEY not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Regenerating image for content ${content_id}, moment: ${moment}, provider: ${imageProvider}`);

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
          const body = await createRes.clone().json();
          if (typeof body?.retry_after === "number") waitSec = Math.max(body.retry_after + 2, 8);
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
        console.error("Image API error:", imageResponse.status);
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


    // Upload to storage (upsert to replace existing)
    const filePath = `${content_id}/${moment}.png`;

    const { error: uploadError } = await supabase.storage
      .from("botanical-faceless-visuals")
      .upload(filePath, imageBuffer, {
        contentType: "image/png",
        upsert: true
      });

    if (uploadError) {
      console.error("Upload failed:", uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("botanical-faceless-visuals")
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;
    console.log("Image uploaded successfully:", publicUrl);

    // Update the visual in the database
    const { data: contentRow, error: fetchError } = await supabase
      .from("botanical_content")
      .select("script_visuals")
      .eq("id", content_id)
      .single();

    if (fetchError || !contentRow) {
      console.error("Failed to fetch content:", fetchError);
      throw new Error("Content not found");
    }

    let visuals = [];
    try {
      visuals = JSON.parse(contentRow.script_visuals || "[]");
    } catch {
      visuals = [];
    }

    // Update the specific visual's image_url (and prompt if we composed a new one)
    const updatedVisuals = visuals.map((v: { moment: string; prompt: string; image_url?: string }) =>
      v.moment === moment
        ? { ...v, image_url: publicUrl, prompt: hasSubject ? finalPrompt : v.prompt }
        : v
    );

    const { error: updateError } = await supabase
      .from("botanical_content")
      .update({ script_visuals: JSON.stringify(updatedVisuals) })
      .eq("id", content_id);

    if (updateError) {
      console.error("Failed to update content:", updateError);
      // Don't throw - image is uploaded, just DB update failed
    }

    return new Response(JSON.stringify({
      success: true,
      image_url: publicUrl,
      moment,
      prompt: hasSubject ? finalPrompt : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

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
