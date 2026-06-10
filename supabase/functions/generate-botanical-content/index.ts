import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate an image and return raw bytes (PNG). Supports two providers.
async function generateImageBytes(
  provider: "lovable" | "replicate",
  prompt: string,
  lovableApiKey: string,
  replicateApiKey: string | undefined,
): Promise<Uint8Array> {
  if (provider === "replicate") {
    if (!replicateApiKey) throw new Error("REPLICATE_API_KEY not configured");
    const GW = "https://connector-gateway.lovable.dev/replicate/v1";
    const authHeaders = {
      "Authorization": `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": replicateApiKey,
      "Content-Type": "application/json",
    };

    const createRes = await fetch(`${GW}/models/black-forest-labs/flux-1.1-pro/predictions`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: "9:16",
          output_format: "png",
          safety_tolerance: 2,
          prompt_upsampling: false,
        },
      }),
    });
    if (!createRes.ok) {
      throw new Error(`Replicate create failed: ${createRes.status} ${await createRes.text()}`);
    }
    const pred = await createRes.json();
    const predId = pred.id;
    if (!predId) throw new Error("Replicate: no prediction id");

    // Poll
    let output: string | string[] | null = null;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, i < 5 ? 2000 : 4000));
      const pollRes = await fetch(`${GW}/predictions/${predId}`, {
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "X-Connection-Api-Key": replicateApiKey,
        },
      });
      if (!pollRes.ok) continue;
      const p = await pollRes.json();
      if (p.status === "succeeded") {
        output = p.output;
        break;
      }
      if (p.status === "failed" || p.status === "canceled") {
        throw new Error(`Replicate prediction ${p.status}: ${p.error ?? ""}`);
      }
    }
    if (!output) throw new Error("Replicate timed out");
    const url = Array.isArray(output) ? output[0] : output;
    if (typeof url !== "string") throw new Error("Replicate: invalid output");
    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new Error(`Replicate image fetch failed: ${imgRes.status}`);
    return new Uint8Array(await imgRes.arrayBuffer());
  }

  // Default: Lovable AI (Nano Banana)
  const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!imageResponse.ok) {
    throw new Error(`Lovable image API error: ${imageResponse.status}`);
  }
  const imageData = await imageResponse.json();
  const base64Image = imageData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!base64Image || typeof base64Image !== "string") {
    throw new Error("No image data from Lovable AI");
  }
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
  return Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
}


const EXCLUDE_COUNT = 5;
const REQUIRED_VISUAL_COUNT = 6;
const REQUIRED_MOMENTS = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"] as const;

const buildSystemPrompt = (noveltyBlock: string) => `You are a zero-memory botanical discovery engine.

${noveltyBlock}

You MUST return valid JSON.
Do NOT include markdown.
Do NOT include explanations.
Do NOT include extra keys.
Do NOT include text outside the JSON object.

If you cannot comply, return an empty JSON object: {}

## FACT DISCOVERY RULES

Select ONE real plant with ONE specific, counterintuitive, verifiable fact that:
- Sounds wrong at first
- Is historically or biologically grounded
- Is explainable clearly in 1-2 sentences
- Is visually representable

Do NOT choose: generic health benefits, vague "contains compounds" statements, folklore, or multi-plant comparisons.

## SCRIPT STRUCTURE (30-35 seconds)

- hook: Introduce the idea indirectly (0-4s)
- dangle_1: Express doubt or curiosity (4-9s)
- rehook: Reveal a common misunderstanding (9-14s)
- dangle_2: Reframe the idea surprisingly (14-20s)
- payoff: Set up why the fact sounds wrong (20-25s)
- verified_truth: State the true botanical fact concretely (25-32s)
- close: Always end with "My brother knows plants. I verify the facts." (32-35s)

Tone: Calm, curious, confident, no jargon.

## THUMBNAIL PROMPT (CINEMATIC EDUCATIONAL THUMBNAIL SYSTEM)

Generate a complete, self-contained vertical 9:16 thumbnail prompt that follows this exact system:

CORE IDENTITY:
- Cinematic mood, museum/archive aesthetic
- Architectural editorial design language
- Emotional tension and intellectual curiosity
- Institutional credibility — feels like a documentary frame, museum exhibition panel, or research archive

COMPOSITION:
- Large focal botanical subject as a museum-grade specimen
- One primary idea, strong hierarchy
- Top-half symbolism, bottom-third title placement
- Symmetry, generous negative space, balanced spacing
- Contemplative arrangement with emotional restraint

LIGHTING & ATMOSPHERE:
- Cinematic low-key lighting, soft directional source
- Depth via haze, smoke, shadow falloff, atmospheric separation
- Texture, grain, restraint

COLOR PALETTE (strict):
- Charcoal, umber, warm parchment, bone, muted olive, soft stone
- No saturation, no bright colors

TYPOGRAPHY:
- Refined serif for institutional/archival feel OR condensed sans-serif for cinematic headline
- Minimal text, strong spacing, no decorative effects
- Headline should create a question, not explain the answer
- Use a curiosity-driven structure: contradiction, hidden truth, misunderstanding, or authority challenge
  (e.g. "NOT WHAT YOU THINK", "MOST PEOPLE GET THIS WRONG", "THE REAL DIFFERENCE")

SYMBOLIC SUPPORT:
- Introduce subtle symbolic elements tied directly to the botanical topic
- Optimize for small-screen readability

NEVER INCLUDE:
- Emojis, neon colors, cartoon styling, futuristic interfaces
- Gaming aesthetics, influencer-style effects, busy infographics
- Modern social-media aesthetics

The prompt MUST be fully self-contained (zero memory): restate subject, lighting, palette, composition, typography, and constraints every time.

## CAPTION

Two lines: Line 1 is calm disbelief, Line 2 is reinforcing insight. No hashtags.

## PART 2 HOOK

One sentence teasing a deeper pattern without resolving it.

## GLOBAL FACELESS VISUAL STYLE LOCK (MANDATORY)

ALL faceless visuals MUST conform to ONE unified visual system.

This system is called:
"Warm Botanical Plate"

This is NOT optional.
This applies to EVERY faceless visual prompt, regardless of script moment.

If a visual does not match this system, it is INVALID.

### Warm Botanical Plate — Canonical Style

Vertical 9:16 light-mode botanical plate on warm cream / parchment / bone textured paper with soft natural grain, gentle vignette, and soft natural top-light. The overall feel is calm, contemplative, archival, museum-quality.

The plate MUST contain ONLY:
- ONE hero photographic botanical specimen, slightly desaturated, museum-grade, centered or composed on the rule of thirds, occupying most of the frame.
- A faint golden-ratio circle overlay behind/around the specimen.
- Thin geometric construction lines (horizontal + vertical) extending toward the edges.
- Small circular tick markers / nodes along the construction lines at the edges (like surveyor or architectural reference points).

ABSOLUTELY NO TEXT OF ANY KIND inside the image. Zero typography. Zero labels. Zero numbers. Zero captions.

EXPLICITLY FORBIDDEN ELEMENTS (do NOT render any of these):
- Common name label
- Latin binomial
- Any short description block (3-4 line paragraph)
- "PLATE — 0X" tag or any plate-number label
- "Fig. 1" / "Branch" / any figure caption
- "Morphology" header or any section header
- A/B/C/D anatomical row, hand-drawn anatomical mini-illustrations, flower/fruit/seed cross-section diagrams
- Circular "Scale 1:2" diagram or any scale label
- "BOTANICAL STUDY ARCHIVE", "MMXXIV", or any footer text
- Border frame around the plate
- Any other text annotations, numeric measurements, axis labels, arrows with words, or written marks
- Dark / charcoal / near-black backgrounds (this is a LIGHT warm-paper plate, not a dark plate)
- Saturated or bright colors, neon, modern UI, icons, emojis
- People, faces, hands, silhouettes, insects, desks, books, tools, magnifying glasses, jungle or natural environments

Palette: warm cream, parchment, bone, ivory, soft sage, muted olive, graphite line work. Nothing saturated.

Mood: calm, intellectual, archival, meditative, editorial, museum-quality.

Aspect ratio: 9:16 vertical
Style: Warm Botanical Plate
Lighting: soft natural top-light on warm paper
Texture: warm cream / parchment paper, fine natural grain, gentle vignette

SHORT VERSION:
Warm cream parchment paper, vertical 9:16, ONE photographic botanical specimen slightly desaturated and museum-grade, faint golden-ratio circle overlay, thin geometric construction lines with small circular tick markers at the edges, soft natural top-light, calm archival editorial mood, ABSOLUTELY NO TEXT OR LABELS ANYWHERE IN THE IMAGE.

CONSISTENCY LINE (REQUIRED AT THE END OF EVERY PROMPT):
Use the exact same Warm Botanical Plate style. Only change the botanical subject. Do not change the paper, lighting, golden-ratio overlay, construction lines, palette, or overall visual system. NO TEXT in the image under any circumstance.

## FACELESS VISUALS (STYLE-LOCKED)

Generate EXACTLY 6 faceless visual prompts — one for EACH of these moments, in this exact set:
hook, dangle_1, rehook, dangle_2, verified_truth, close

Each prompt MUST:
- Use the Warm Botanical Plate style defined above
- Be fully self-contained (restate the entire warm-paper style from scratch — zero memory)
- Describe ONLY the specimen + the faint golden-ratio + construction-line overlay
- Explicitly state "no text, no labels, no numbers, no captions anywhere in the image"
- Differ only in WHAT part of the plant is shown, not HOW it is styled

All 6 plates MUST show the SAME WHOLE PHOTOGRAPHIC SPECIMEN of the plant (think: one tall sunflower with stem + leaves + head, full plant, centered, occupying most of the frame) on the warm cream paper with the faint golden-ratio circle and thin construction lines + small circular tick markers. The composition, crop, framing, lighting, palette, and overlay are IDENTICAL across all 6 plates.

The ONLY thing that may vary between the 6 plates is the BACKGROUND TREATMENT of the warm paper — e.g. slightly different grain, slightly different vignette intensity, slightly different placement of the faint construction-line + tick-marker pattern. Nothing else changes. Same plant, same pose, same crop, same lighting.

Moments do NOT change the subject, the crop, the camera angle, or the part of the plant shown. Every plate is the SAME hero specimen view. Treat the "moment" label as metadata only — it MUST NOT alter the image. No cross-sections, no zoom-ins, no anatomical close-ups, no alternate angles, no different parts of the plant.

Each visual MUST map to a DIFFERENT script moment (metadata only).
Exactly 6 visuals — NO MORE, NO LESS. NO duplicate moments. All 6 moments above MUST be present.

If you are tempted to vary the subject, crop, camera angle, composition, or to add text/labels/numbers:
DO NOT.
The 6 plates are visually near-identical hero specimens of the same plant on warm paper.



Return ONLY this exact JSON structure:
{
  "plant_name": "string - the specific plant name",
  "verified_fact": "string - the core botanical fact in one sentence",
  "script": {
    "hook": "string",
    "dangle_1": "string",
    "rehook": "string",
    "dangle_2": "string",
    "payoff": "string",
    "verified_truth": "string",
    "close": "string"
  },
  "thumbnail_prompt": {
    "mode": "light",
    "prompt": "string - complete image generation prompt"
  },
  "caption": "string",
  "part2_hook": "string",
  "faceless_visuals": [
    {
      "moment": "hook | dangle_1 | rehook | dangle_2 | verified_truth | close",
      "prompt": "string - complete self-contained image generation prompt"
    }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Fetch recent plants for novelty constraint
    const { data: recentPlants, error: fetchError } = await supabase
      .from("botanical_content")
      .select("plant_name")
      .not("plant_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(EXCLUDE_COUNT);

    if (fetchError) {
      console.error("Failed to fetch recent plants:", fetchError);
    }

    const recentPlantList = (recentPlants ?? [])
      .map((row) => `- ${row.plant_name}`)
      .join("\n");

    console.log("Recent plants to exclude:", recentPlantList || "(none)");

    const PLANT_NOVELTY_BLOCK = `
PLANT SELECTION CONSTRAINT (MANDATORY):

You must select a real plant that has NOT been used recently.

You are STRICTLY FORBIDDEN from selecting any plant in the list below.

Recently used plants:
${recentPlantList || "- (none)"}

Rules:
- You MUST choose a different real plant not listed above.
- Do NOT repeat, rephrase, or choose closely related variants.
- Do NOT choose cultivars, subspecies, or alternate names.
- If uncertain, choose a different plant.

Failure conditions:
- Selecting a forbidden plant makes the output invalid.
- Selecting a synonymous or related plant makes the output invalid.

Novelty is REQUIRED.
Repetition is NOT allowed.
`;

    const systemPrompt = buildSystemPrompt(PLANT_NOVELTY_BLOCK);

    console.log("Calling AI for content generation...");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate a complete botanical content package now." }
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway request failed: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("No content received from AI");
    }

    console.log("Raw AI response length:", rawContent.length);

    // Parse JSON
    let parsed;
    try {
      let cleanedContent = rawContent.trim();
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent.slice(7);
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.slice(3);
      }
      if (cleanedContent.endsWith("```")) {
        cleanedContent = cleanedContent.slice(0, -3);
      }
      cleanedContent = cleanedContent.trim();
      
      parsed = JSON.parse(cleanedContent);
      console.log("JSON parsed successfully, keys:", Object.keys(parsed));
    } catch (e) {
      console.error("JSON parse failed:", e);
      console.error("Raw content preview:", rawContent.substring(0, 500));
      throw new Error("AI returned invalid JSON");
    }

    // Validate required fields
    if (!parsed.plant_name || !parsed.script || !parsed.thumbnail_prompt) {
      console.error("Missing required fields in parsed content");
      throw new Error("AI response missing required fields");
    }

    // Validate faceless_visuals — must be exactly 6, one per required moment
    if (!Array.isArray(parsed.faceless_visuals) ||
        parsed.faceless_visuals.length !== REQUIRED_VISUAL_COUNT) {
      console.error("faceless_visuals invalid count:", parsed.faceless_visuals?.length);
      throw new Error(`faceless_visuals must contain exactly ${REQUIRED_VISUAL_COUNT} items`);
    }

    const usedMoments = new Set<string>();
    for (const visual of parsed.faceless_visuals) {
      if (!visual.moment || !visual.prompt) {
        throw new Error("Each faceless_visual must have moment and prompt");
      }
      if (!REQUIRED_MOMENTS.includes(visual.moment)) {
        throw new Error(`Invalid moment: ${visual.moment}`);
      }
      if (usedMoments.has(visual.moment)) {
        throw new Error(`Duplicate moment: ${visual.moment}`);
      }
      usedMoments.add(visual.moment);
    }
    for (const required of REQUIRED_MOMENTS) {
      if (!usedMoments.has(required)) {
        throw new Error(`Missing required moment: ${required}`);
      }
    }

    console.log("faceless_visuals validated: 6 unique moments");

    // Novelty guard
    if (recentPlants?.some(p =>
      p.plant_name?.toLowerCase() === parsed.plant_name?.toLowerCase()
    )) {
      console.error("Novelty violation: AI selected recently used plant:", parsed.plant_name);
      throw new Error("Novelty violation: repeated plant");
    }

    // Sort visuals by script order; initialize with image_url: null
    const visualsInitial = [...parsed.faceless_visuals]
      .sort((a, b) => REQUIRED_MOMENTS.indexOf(a.moment) - REQUIRED_MOMENTS.indexOf(b.moment))
      .map((v) => ({ moment: v.moment, prompt: v.prompt, image_url: null as string | null }));

    // INSERT content to DB immediately (with empty image_urls)
    console.log("Inserting content to database...");
    const { data: insertedRow, error: insertError } = await supabase
      .from("botanical_content")
      .insert({
        plant_name: parsed.plant_name,
        verified_fact: parsed.verified_fact,
        script: JSON.stringify(parsed.script),
        thumbnail: JSON.stringify(parsed.thumbnail_prompt),
        caption: parsed.caption,
        part2_hook: parsed.part2_hook,
        script_visuals: JSON.stringify(visualsInitial),
        raw_content: rawContent,
      })
      .select("id")
      .single();

    if (insertError || !insertedRow?.id) {
      console.error("Failed to insert content:", insertError);
      throw new Error("Failed to save content to database");
    }

    const contentId = insertedRow.id;
    console.log("Content saved with ID:", contentId);

    // Background image generation — all 6 in parallel
    const generateAllImages = async () => {
      console.log(`Background: generating ${visualsInitial.length} images in parallel...`);

      const results = await Promise.all(
        visualsInitial.map(async (visual) => {
          try {
            const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image-preview",
                messages: [{ role: "user", content: visual.prompt }],
                modalities: ["image", "text"],
              }),
            });

            if (!imageResponse.ok) {
              console.error(`Image API error for ${visual.moment}:`, imageResponse.status);
              return { ...visual, image_url: null };
            }

            const imageData = await imageResponse.json();
            const base64Image = imageData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

            if (!base64Image || typeof base64Image !== "string") {
              console.error(`No valid image data for ${visual.moment}`);
              return { ...visual, image_url: null };
            }

            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
            const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const filePath = `${contentId}/${visual.moment}.png`;

            const { error: uploadError } = await supabase.storage
              .from("botanical-faceless-visuals")
              .upload(filePath, imageBuffer, {
                contentType: "image/png",
                upsert: true,
              });

            if (uploadError) {
              console.error(`Upload failed for ${visual.moment}:`, uploadError);
              return { ...visual, image_url: null };
            }

            const { data: urlData } = supabase.storage
              .from("botanical-faceless-visuals")
              .getPublicUrl(filePath);

            console.log(`Image complete for ${visual.moment}`);

            // Incrementally update DB so client polling sees progress
            const updated = visualsInitial.map((v) =>
              v.moment === visual.moment ? { ...v, image_url: urlData.publicUrl } : v
            );
            // Merge with any already-completed images by re-reading current row
            const { data: currentRow } = await supabase
              .from("botanical_content")
              .select("script_visuals")
              .eq("id", contentId)
              .single();

            let currentVisuals = updated;
            if (currentRow?.script_visuals) {
              try {
                const parsedCurrent = typeof currentRow.script_visuals === "string"
                  ? JSON.parse(currentRow.script_visuals)
                  : currentRow.script_visuals;
                currentVisuals = parsedCurrent.map((v: typeof visualsInitial[number]) =>
                  v.moment === visual.moment ? { ...v, image_url: urlData.publicUrl } : v
                );
              } catch {
                // fallback to `updated`
              }
            }

            await supabase
              .from("botanical_content")
              .update({ script_visuals: JSON.stringify(currentVisuals) })
              .eq("id", contentId);

            return { ...visual, image_url: urlData.publicUrl };
          } catch (err) {
            console.error(`Image error for ${visual.moment}:`, err);
            return { ...visual, image_url: null };
          }
        })
      );

      const successCount = results.filter((v) => v.image_url).length;
      console.log(`Background image generation complete: ${successCount} of ${results.length}`);
    };

    // Fire and forget via EdgeRuntime.waitUntil (keeps function alive)
    // @ts-ignore - EdgeRuntime is available in Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(generateAllImages());
    } else {
      // Fallback: run without waiting
      generateAllImages();
    }

    // Return immediately with all 6 visual slots (image_url: null) so UI renders all plates
    parsed.faceless_visuals = visualsInitial;

    return new Response(JSON.stringify({
      success: true,
      content: parsed,
      content_id: contentId,
      raw: rawContent,
    }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in generate-botanical-content:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ 
      success: false, 
      error: message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
