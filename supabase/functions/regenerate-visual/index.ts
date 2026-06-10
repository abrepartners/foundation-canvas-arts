import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Canonical "Architectural Botanical Study Plate" — kept in sync with
// src/lib/plateTemplate.ts. Only the botanical subject changes per plate.
const PLATE_TEMPLATE = `Vertical 9:16 dark-mode botanical archive plate on deep charcoal to near-black textured paper with fine grain, subtle parchment texture, soft vignette, and low-key directional light from the upper left.

The plate MUST include ALL of the following layout elements (strict template — every element must appear):

TOP LEFT:
- Plant common name in large refined serif (warm bone/ivory)
- Latin binomial directly below in smaller italic serif
- A 3-4 line short description (evergreen/deciduous, family, native region, notable use) in small muted serif

TOP RIGHT:
- "PLATE — 0X" label in small spaced sans-serif caps

CENTER:
- ONE hero botanical specimen (real photographic specimen aesthetic, slightly desaturated, museum-grade) — a single branch with leaves, fruit, or seed structure
- Thin graphite construction lines, circular golden-ratio overlays, and faint geometric framing behind the specimen
- Numeric annotations along the right edge (e.g. "2.8", "1.618", "0.618", "2.1", "4.7") in small serif
- "Fig. 1  Branch" label in small italic serif beneath the specimen

LOWER SECTION:
- "Morphology" header in small serif
- A short labeled list (A. Flower / B. Fruit / C. Seed — or Cone/Bud/Leaf as appropriate)
- A horizontal row of 3-4 small hand-drawn anatomical illustrations labeled A, B, C, D
- A small circular golden-ratio diagram on the right with "Scale  1:2" label

FOOTER:
- "BOTANICAL STUDY ARCHIVE" in small spaced sans-serif caps on the left
- "MMXXIV" on the right
- Thin border frame around the entire plate

Composition: architectural blueprint meets archival botanical study plate. Hand-drawn botanical sketches, abstract leaves, stems, seed structures, thin graphite construction lines, measurement marks, numeric annotations, subtle diagram labels. Clean, premium, calm, contemplative.

Palette: muted warm-gray, bone, ivory, parchment, sage, olive, graphite. No bright colors, no neon, no cartoon styling, no oversaturated greens.

Mood: cinematic, intellectual, architectural, archival, calm authority, meditative, editorial.

Aspect ratio: 9:16 vertical.
Lighting: low-key, soft upper-left directional light.
Texture: dark paper, fine grain, parchment, subtle vignette.

STYLE CONSTRAINTS (STRICT):
- No people, no faces, no hands, no silhouettes
- No modern elements (phones, screens, logos, brands)
- No bright/neon colors, no cartoon, no 3D render look

CONSISTENCY LINE (REQUIRED):
Use the exact same Architectural Botanical Study Plate style. Only change the botanical subject. Do not change the scene, composition language, lighting, texture, typography style, or overall visual system.`;

interface PlateSubject {
  commonName?: string;
  binomial?: string;
  description?: string;
  specimenNote?: string;
}

function composePrompt(subject: PlateSubject): string {
  const lines = [
    PLATE_TEMPLATE,
    "",
    "BOTANICAL SUBJECT (changes per plate):",
    `- Common name: ${subject.commonName ?? ""}`,
    `- Latin binomial: ${subject.binomial ?? ""}`,
    `- Short description: ${subject.description ?? ""}`,
  ];
  if (subject.specimenNote && subject.specimenNote.trim()) {
    lines.push(`- Hero specimen: ${subject.specimenNote.trim()}`);
  }
  return lines.join("\n");
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

    const finalPrompt: string = hasSubject
      ? composePrompt(subject as PlateSubject)
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
      const createRes = await fetch(`${GW}/models/black-forest-labs/flux-1.1-pro/predictions`, {
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
      if (!createRes.ok) {
        throw new Error(`Replicate create failed: ${createRes.status} ${await createRes.text()}`);
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
