import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXCLUDE_COUNT = 5;
const MAX_VISUALS = 4;
const MAX_EXECUTION_MS = 20000;

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
"Architectural Botanical Study Plate"

This is NOT optional.
This applies to EVERY faceless visual prompt, regardless of script moment.

If a visual does not match this system, it is INVALID.

### Architectural Botanical Study Plate — Canonical Style

Vertical 9:16 dark-mode botanical architectural study plate.
Create a cinematic, intellectual, editorial botanical visual on deep charcoal to near-black textured paper with subtle fine grain, parchment texture, soft vignette, and low-key lighting from the upper left.

The composition should feel like an architectural blueprint mixed with an archival botanical study plate. Use hand-drawn botanical sketches, abstract leaves, stems, seed structures, thin graphite construction lines, measurement marks, numeric annotations, and subtle diagram labels.

Keep the layout clean, premium, calm, and contemplative. The design should feel like museum-grade botanical research, architectural drafting, and cinematic editorial art combined.

Use muted warm-gray, bone, ivory, parchment, sage, olive, and graphite tones. Avoid bright colors, modern neon, cartoon styling, overly saturated greens, or anything that feels generic.

The subject should remain elegant and minimal. The botanical elements should feel intentionally placed, not cluttered. Add soft shadows and depth, but keep the image mostly flat like a high-end printed study plate.

Mood: cinematic, intellectual, architectural, archival, calm authority, meditative, editorial.

Aspect ratio: 9:16 vertical
Style: Architectural Botanical Study Plate
Lighting: low-key, soft upper-left directional light
Texture: dark paper, fine grain, parchment, subtle vignette

SHORT VERSION:
Dark-mode architectural botanical study plate, vertical 9:16, deep charcoal textured paper, hand-drawn botanical sketches, graphite construction lines, measurement marks, numeric annotations, muted bone and warm-gray serif typography, cinematic low-key lighting, archival museum-grade editorial style, calm intellectual mood, premium botanical research aesthetic.

CONSISTENCY LINE (REQUIRED AT THE END OF EVERY PROMPT):
Use the exact same Architectural Botanical Study Plate style. Only change the botanical subject. Do not change the scene, composition language, lighting, texture, typography style, or overall visual system.

STYLE CONSTRAINTS (STRICT):
- No people
- No faces
- No hands
- No silhouettes
- No insects
- No desks, books, tools, magnifying glasses
- No jungle or natural environments
- No icons, emojis, UI, or modern elements
- No bright or saturated colors
- No illustrative diagrams

## FACELESS VISUALS (STYLE-LOCKED)

Generate 3–5 faceless visual prompts.

Each prompt MUST:
- Use the Architectural Botanical Study Plate style defined above
- Be fully self-contained
- Describe ONLY the specimen, not a scene
- Differ only in WHAT part of the plant is shown, not HOW it is styled

Moments control SUBJECT FOCUS only, not style:
- hook → most visually striking structure
- dangle_1 / dangle_2 → supporting anatomical detail
- verified_truth → educational cross-section or labeled structure
- close → whole specimen or simplified form

The visual style MUST remain identical across all moments.

Each visual MUST map to a DIFFERENT script moment.
Allowed moments: hook, dangle_1, rehook, dangle_2, verified_truth, close
NO DUPLICATE MOMENTS - each moment can only appear once.

If you are tempted to vary the visual format, composition, or environment:
DO NOT.
Only vary the botanical subject being shown.

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

    // Validate faceless_visuals
    if (!Array.isArray(parsed.faceless_visuals) || 
        parsed.faceless_visuals.length < 3 || 
        parsed.faceless_visuals.length > 5) {
      console.error("faceless_visuals invalid:", parsed.faceless_visuals?.length);
      throw new Error("faceless_visuals must be an array of 3-5 items");
    }

    const validMoments = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"];
    const usedMoments = new Set<string>();

    for (const visual of parsed.faceless_visuals) {
      if (!visual.moment || !visual.prompt) {
        throw new Error("Each faceless_visual must have moment and prompt");
      }
      if (!validMoments.includes(visual.moment)) {
        throw new Error(`Invalid moment: ${visual.moment}`);
      }
      if (usedMoments.has(visual.moment)) {
        console.error("Duplicate moment detected:", visual.moment);
        throw new Error(`Duplicate moment: ${visual.moment}`);
      }
      usedMoments.add(visual.moment);
    }

    console.log("faceless_visuals validated:", parsed.faceless_visuals.length, "unique moments");

    // Novelty guard
    if (recentPlants?.some(p => 
      p.plant_name?.toLowerCase() === parsed.plant_name?.toLowerCase()
    )) {
      console.error("Novelty violation: AI selected recently used plant:", parsed.plant_name);
      throw new Error("Novelty violation: repeated plant");
    }

    // INSERT content to DB to get real ID before image generation
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
        script_visuals: JSON.stringify(parsed.faceless_visuals),
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

    // Image generation with timeout guard
    const startTime = Date.now();
    const momentOrder = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"];
    
    // Sort by script order and take max 4
    const visualsToProcess = [...parsed.faceless_visuals]
      .sort((a, b) => momentOrder.indexOf(a.moment) - momentOrder.indexOf(b.moment))
      .slice(0, MAX_VISUALS);

    console.log(`Processing ${visualsToProcess.length} faceless visuals (max ${MAX_VISUALS})...`);

    let isFirstImage = true;
    const visualsWithImages: Array<{ moment: string; prompt: string; image_url: string | null }> = [];

    // Generate images SEQUENTIALLY
    for (const visual of visualsToProcess) {
      const elapsed = Date.now() - startTime;
      
      // Check timeout before each image
      if (elapsed > MAX_EXECUTION_MS) {
        console.warn(`Timeout guard triggered at ${elapsed}ms, skipping remaining images`);
        visualsWithImages.push({ ...visual, image_url: null });
        continue;
      }

      try {
        console.log(`Generating image for moment: ${visual.moment} (${elapsed}ms elapsed)`);
        
        const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [{ role: "user", content: visual.prompt }],
            modalities: ["image", "text"]
          }),
        });

        if (!imageResponse.ok) {
          console.error(`Image API error for ${visual.moment}:`, imageResponse.status);
          visualsWithImages.push({ ...visual, image_url: null });
          continue;
        }

        const imageData = await imageResponse.json();

        // Log first raw response for debugging
        if (isFirstImage) {
          console.log("Raw image API response structure:", JSON.stringify({
            hasChoices: !!imageData.choices,
            choicesLength: imageData.choices?.length,
            hasMessage: !!imageData.choices?.[0]?.message,
            hasImages: !!imageData.choices?.[0]?.message?.images,
            imagesLength: imageData.choices?.[0]?.message?.images?.length,
            firstImageKeys: imageData.choices?.[0]?.message?.images?.[0] 
              ? Object.keys(imageData.choices[0].message.images[0]) 
              : null
          }));
          isFirstImage = false;
        }

        // Defensive parsing
        const base64Image = imageData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (!base64Image || typeof base64Image !== "string") {
          console.error(`No valid image data for ${visual.moment}`);
          visualsWithImages.push({ ...visual, image_url: null });
          continue;
        }

        // Extract base64 data and convert to binary
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        // Use REAL content ID for storage path
        const filePath = `${contentId}/${visual.moment}.png`;
        
        const { error: uploadError } = await supabase.storage
          .from("botanical-faceless-visuals")
          .upload(filePath, imageBuffer, {
            contentType: "image/png",
            upsert: true
          });

        if (uploadError) {
          console.error(`Upload failed for ${visual.moment}:`, uploadError);
          visualsWithImages.push({ ...visual, image_url: null });
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("botanical-faceless-visuals")
          .getPublicUrl(filePath);

        console.log(`Image complete for ${visual.moment}`);
        visualsWithImages.push({ ...visual, image_url: urlData.publicUrl });

      } catch (err) {
        console.error(`Image error for ${visual.moment}:`, err);
        visualsWithImages.push({ ...visual, image_url: null });
      }
    }

    // Add any remaining visuals (beyond MAX_VISUALS) without images
    const processedMoments = new Set(visualsWithImages.map(v => v.moment));
    for (const visual of parsed.faceless_visuals) {
      if (!processedMoments.has(visual.moment)) {
        visualsWithImages.push({ ...visual, image_url: null });
      }
    }

    const successCount = visualsWithImages.filter(v => v.image_url).length;
    console.log(`Image generation complete: ${successCount} of ${visualsWithImages.length}`);

    // Update the DB record with image URLs
    const { error: updateError } = await supabase
      .from("botanical_content")
      .update({
        script_visuals: JSON.stringify(visualsWithImages),
      })
      .eq("id", contentId);

    if (updateError) {
      console.error("Failed to update with image URLs:", updateError);
    }

    // Replace faceless_visuals in response
    parsed.faceless_visuals = visualsWithImages;

    return new Response(JSON.stringify({ 
      success: true, 
      content: parsed,
      content_id: contentId,
      raw: rawContent 
    }), {
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
