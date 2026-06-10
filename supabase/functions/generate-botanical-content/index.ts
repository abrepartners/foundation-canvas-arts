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

    // Create prediction with 429 backoff (Replicate enforces 6/min + burst 1 under $5 credit)
    let createRes: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      createRes = await fetch(`${GW}/models/black-forest-labs/flux-1.1-pro/predictions`, {
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

Do NOT include section labels such as "Hook:", "Dangle 1:", "Re-hook:", "Dangle 2:", "Payoff:", "Verified Truth:", "Close:", or timing labels like "0-4s" or "(0-4s)" inside the script text. Output only the spoken words for each section.

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

ALL six faceless visuals MUST use ONE locked visual style:
"Architectural Botanical Study Plate"

Same style across all six plates. Different composition and storytelling purpose per moment.

### Architectural Botanical Study Plate — Locked Style

Vertical 9:16 dark mode botanical study plate. Deep charcoal textured paper. Near black parchment background. Fine paper grain. Soft vignette. Cinematic upper left directional lighting. Muted ivory, bone, warm gray, sage, olive, faded green, graphite, and aged natural tones. Realistic botanical or organic specimen illustration. Architectural blueprint layout. Fine graphite construction lines. Measurement brackets. Scientific annotations. Figure labels. Small numeric markers. Subtle museum style serif typography. Premium archival research aesthetic.

AVOID: people, modern elements, neon, cartoon style, bright colors, glossy advertising style, Canva style layouts, white backgrounds, random decorative elements, clutter, and text heavy graphics.

### Per-Moment Composition Briefs (the ONLY thing that changes between plates)

- hook: Boldest plate. Large hero specimen filling most of the frame. Mysterious, scroll stopping, dramatic upper left light, deep vignette.
- dangle_1: Close up clue. Partial reveal. One isolated detail such as a leaf edge, bud, tendril, root, seed, flower part, fruit surface, or botanical texture cropped tight. Suspenseful. Does not show the whole subject.
- rehook: Second visual punch. Stronger angle, higher contrast, larger scale, more construction lines and brackets framing the specimen.
- dangle_2: Investigative detail. Cross section, anatomy, hidden internal structure, magnified scientific breakdown, measurement brackets, numeric markers.
- verified_truth: Most credible plate. Organized evidence layout. Labeled A, B, C, D anatomical row. Figure annotations. Clean structured reveal.
- close: Final archive plate. Calm, resolved, premium, minimal. Single specimen, golden ratio diagram, small archival footer feel.

## FACELESS VISUALS (STYLE-LOCKED, MOMENT-VARIED)

Generate EXACTLY 6 faceless visual prompts — one for EACH of these moments, in this exact set:
hook, dangle_1, rehook, dangle_2, verified_truth, close

Each faceless_visuals[i].prompt MUST be a fully standalone, Replicate-ready image prompt that:
- Restates the ENTIRE Architectural Botanical Study Plate locked style block above (zero memory — assume the image model has never seen any previous prompt).
- Applies the correct per-moment composition brief from the list above for that moment.
- Names the chosen botanical SUBJECT explicitly (the same subject across all six prompts).
- Includes the AVOID list.
- Ends with this exact consistency line, with {subject} replaced by the chosen subject:
  "Use the exact same Architectural Botanical Study Plate style across all six plates. Only the composition and storytelling purpose change. Subject: {subject}."

Rules:
- Same locked visual style across all 6 plates. Same palette, paper, lighting, typography system.
- Different composition / camera / crop / storytelling purpose per moment, following its brief.
- Exactly 6 visuals — NO MORE, NO LESS. NO duplicate moments. All 6 moments above MUST be present.
- Each visual MUST map to a DIFFERENT script moment.
- The subject is dynamic — use the plant you selected for this package. Do not hard-code any example subject.





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
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    let imageProvider: "lovable" | "replicate" = "lovable";
    try {
      const body = await req.json();
      if (body?.image_provider === "replicate") imageProvider = "replicate";
    } catch {
      // no body — default to lovable
    }
    if (imageProvider === "replicate" && !REPLICATE_API_KEY) {
      throw new Error("Replicate selected but REPLICATE_API_KEY not configured");
    }
    console.log(`Image provider: ${imageProvider}`);

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

    // Background image generation — parallel for lovable, sequential for replicate (rate-limited)
    const generateOne = async (visual: typeof visualsInitial[number]) => {
      try {
        const imageBuffer = await generateImageBytes(
          imageProvider,
          visual.prompt,
          LOVABLE_API_KEY,
          REPLICATE_API_KEY,
        );
        const filePath = `${contentId}/${visual.moment}.png`;

        const { error: uploadError } = await supabase.storage
          .from("botanical-faceless-visuals")
          .upload(filePath, imageBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload failed for ${visual.moment}:`, uploadError);
          await mergeVisual(visual.moment, { image_url: null, error: `upload: ${uploadError.message}` });
          return { ...visual, image_url: null };
        }

        const { data: urlData } = supabase.storage
          .from("botanical-faceless-visuals")
          .getPublicUrl(filePath);

        console.log(`Image complete for ${visual.moment}`);
        await mergeVisual(visual.moment, { image_url: urlData.publicUrl, error: null });
        return { ...visual, image_url: urlData.publicUrl };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Image error for ${visual.moment}:`, msg);
        await mergeVisual(visual.moment, { image_url: null, error: msg.slice(0, 240) });
        return { ...visual, image_url: null };
      }
    };

    // Re-read latest row and patch a single visual, preserving siblings' progress
    const mergeVisual = async (
      moment: string,
      patch: { image_url: string | null; error?: string | null },
    ) => {
      const { data: currentRow } = await supabase
        .from("botanical_content")
        .select("script_visuals")
        .eq("id", contentId)
        .single();
      let arr = visualsInitial as Array<Record<string, unknown>>;
      if (currentRow?.script_visuals) {
        try {
          arr = typeof currentRow.script_visuals === "string"
            ? JSON.parse(currentRow.script_visuals)
            : currentRow.script_visuals;
        } catch { /* fallback */ }
      }
      const next = arr.map((v) => v.moment === moment ? { ...v, ...patch } : v);
      await supabase
        .from("botanical_content")
        .update({ script_visuals: JSON.stringify(next) })
        .eq("id", contentId);
    };

    const generateAllImages = async () => {
      console.log(`Background: generating ${visualsInitial.length} images via ${imageProvider} (parallel)...`);
      const results = await Promise.all(visualsInitial.map(generateOne));
      const successCount = results.filter((v) => v.image_url).length;
      console.log(`Background image generation complete: ${successCount} of ${visualsInitial.length}`);
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
