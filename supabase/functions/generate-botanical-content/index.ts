import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";
import { isStopped, updateJob } from "../_shared/providerJobs.ts";
import {
  generateTrackedReplicateImage,
  generateTrackedReplicateText,
  type TrackedImageResult,
} from "../_shared/trackedReplicate.ts";
import { getReplicateApiKey } from "../_shared/secrets.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

// Run a Replicate prediction for any official model, return output URL.
async function runReplicatePrediction(
  model: string, // e.g. "black-forest-labs/flux-1.1-pro" or "openai/gpt-image-2"
  input: Record<string, unknown>,
  replicateApiKey: string,
): Promise<string> {
  const GW = "https://api.replicate.com/v1";
  const authHeaders = {
    Authorization: `Bearer ${replicateApiKey}`,
    "Content-Type": "application/json",
  };

  let createRes: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    createRes = await fetch(`${GW}/models/${model}/predictions`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input }),
    });
    if (createRes.status !== 429) break;
    let waitSec = 12;
    try {
      const body = await createRes.clone().json();
      if (typeof body?.retry_after === "number")
        waitSec = Math.max(body.retry_after + 2, 8);
    } catch {
      /* ignore */
    }
    console.log(
      `Replicate 429; retrying in ${waitSec}s (attempt ${attempt + 1}/3)`,
    );
    await new Promise((r) => setTimeout(r, waitSec * 1000));
  }
  if (!createRes || !createRes.ok) {
    const txt = createRes ? await createRes.text() : "no response";
    throw new Error(`Replicate create failed: ${createRes?.status} ${txt}`);
  }
  const pred = await createRes.json();
  const predId = pred.id;
  if (!predId) throw new Error("Replicate: no prediction id");

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, i < 5 ? 2000 : 4000));
    const pollRes = await fetch(`${GW}/predictions/${predId}`, {
      headers: {
        Authorization: `Bearer ${replicateApiKey}`,
      },
    });
    if (!pollRes.ok) continue;
    const p = await pollRes.json();
    if (p.status === "succeeded") {
      const url = Array.isArray(p.output) ? p.output[0] : p.output;
      if (typeof url !== "string") throw new Error("Replicate: invalid output");
      return url;
    }
    if (p.status === "failed" || p.status === "canceled") {
      throw new Error(`Replicate prediction ${p.status}: ${p.error ?? ""}`);
    }
  }
  throw new Error("Replicate timed out");
}

async function runReplicateTextCompletion(
  input: Record<string, unknown>,
  replicateApiKey: string,
  tracking?: {
    supabase: SupabaseClient;
    animationRowId: string;
  },
): Promise<string> {
  const GW = "https://api.replicate.com/v1";
  const model = "google/gemini-2.5-flash";
  if (tracking) {
    return generateTrackedReplicateText({
      supabase: tracking.supabase,
      rowId: tracking.animationRowId,
      jobKey: "content:text",
      model,
      input,
      replicateApiKey,
    });
  }
  const createRes = await fetch(`${GW}/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${replicateApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });
  if (!createRes.ok) {
    const txt = await createRes.text();
    throw new Error(`Replicate text create failed: ${createRes.status} ${txt}`);
  }
  const pred = await createRes.json();
  const predId = pred.id;
  if (!predId) throw new Error("Replicate text: no prediction id");

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, i < 5 ? 1000 : 2500));
    const pollRes = await fetch(`${GW}/predictions/${predId}`, {
      headers: {
        Authorization: `Bearer ${replicateApiKey}`,
      },
    });
    if (!pollRes.ok) continue;
    const p = await pollRes.json();
    if (p.status === "succeeded") {
      const output = Array.isArray(p.output) ? p.output.join("") : p.output;
      if (typeof output !== "string" || output.trim().length === 0) {
        throw new Error("Replicate text: empty output");
      }
      return output;
    }
    if (p.status === "failed" || p.status === "canceled") {
      throw new Error(`Replicate text prediction ${p.status}: ${p.error ?? ""}`);
    }
  }
  throw new Error("Replicate text timed out");
}

// Generate an image through the owner's Replicate account.
async function generateImageBytes(
  provider: "replicate" | "openai",
  prompt: string,
  replicateApiKey: string | undefined,
  tracking?: {
    supabase: SupabaseClient;
    animationRowId: string;
    jobKey: string;
  },
): Promise<{ bytes: Uint8Array; jobId?: string }> {
  if (!replicateApiKey) throw new Error("REPLICATE_API_KEY not configured");
    const model =
      provider === "openai"
        ? "openai/gpt-image-2"
        : "black-forest-labs/flux-1.1-pro";
    const input: Record<string, unknown> =
      provider === "openai"
        ? {
            prompt,
            quality: "high",
            aspect_ratio: "9:16",
            output_format: "jpeg",
          }
        : {
            prompt,
            aspect_ratio: "9:16",
            output_format: "jpeg",
            safety_tolerance: 2,
            prompt_upsampling: false,
          };
    if (tracking) {
      const result: TrackedImageResult = await generateTrackedReplicateImage({
        supabase: tracking.supabase,
        rowId: tracking.animationRowId,
        jobKey: tracking.jobKey,
        model,
        input,
        replicateApiKey,
      });
      return result;
    }

    const url = await runReplicatePrediction(model, input, replicateApiKey);
    const imgRes = await fetch(url);
    if (!imgRes.ok)
      throw new Error(`Replicate image fetch failed: ${imgRes.status}`);
    return { bytes: new Uint8Array(await imgRes.arrayBuffer()) };
}

const EXCLUDE_COUNT = 50;
const REQUIRED_VISUAL_COUNT = 6;
const REQUIRED_MOMENTS = [
  "hook",
  "dangle_1",
  "rehook",
  "dangle_2",
  "verified_truth",
  "close",
] as const;

const buildSystemPrompt = (
  noveltyBlock: string,
) => `You are a zero-memory botanical discovery engine.

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

## CAPTION (SEO long-form, replaces any short caption)

The "caption" field MUST be a long-form, SEO-structured educational caption written in the calm "verified botanical explanation" voice. This caption is published as the post description on TikTok and Instagram, so it must be search-friendly while still sounding natural and human.

Length: 175–300 words. Not shorter. Not a witty one-liner.

Tone: educational, calm, confident, visually descriptive, easy to understand. Reads like a verified science explanation. Never hype, never slang, never ad copy, never emojis.

Structure (follow in this exact order, with blank lines between sections, using real newline characters \n inside the JSON string):

0. A bold title line at the very top: a single short headline (4–10 words) naming the surprising angle of the post. Wrap it in **double asterisks** so it renders as bold. No emojis. Only "." or "?" allowed as ending punctuation. Followed by a blank line. This is the ONLY place markdown bold is allowed.
1. A strong, surprising or slightly counterintuitive hook statement about the selected plant/topic. One short paragraph.
2. A line that says some variation of: "That sounds wrong until you understand how plants are actually classified."
3. A paragraph that explains, in plain language, the botanical classification principle at play (structure, development, reproduction — not taste, size, tradition, or kitchen use). Reference "botanical classification", "plant structure", "plant reproduction", or "common names vs scientific definitions" naturally.
4. A short paragraph stating the specific plant fact clearly.
5. The line: "Most confusion about plant facts comes from relying on common names instead of botanical structure."
6. A "This is why:" header followed by EXACTLY 4 bullet lines. Each bullet starts with the en-dash + space: "– ". Each bullet is one concrete fact about the chosen plant.
7. A paragraph reinforcing that botanical classification focuses on anatomy, reproductive structure, and development — not flavor, sweetness, or grocery categories.
8. A paragraph framing the post as part of an ongoing botanical verification series that visually explains plant science concepts that often sound fake but are scientifically accurate.
9. The brand line, on two separate lines, EXACTLY:
My brother studies plants.
I verify the facts.
10. The line: "More verified botanical explanations coming soon."
11. A "Topics covered:" header followed by EXACTLY 6 searchable keyword phrases, one per line, no bullets, no hashtags. Mix general families (botanical classification, plant structure, seeds vs fruits, fruit definitions, plant reproduction, plant anatomy explained, common names vs scientific definitions, how botanists define [topic], why [topic] is classified this way) with topic-specific variants using the actual plant name.
12. EXACTLY 5 hashtags, one per line, each starting with "#", lowercase or camelCase, relevant to the plant and to botany/plant science. No spaces inside a hashtag. Do not exceed 5. Hashtags are MANDATORY — the caption is invalid without exactly 5 hashtag lines at the very end. If unsure, default to: #botany, #plantscience, #plantfacts, #botanicalclassification, plus one topic-specific tag.

Hard rules:
- Do NOT generate a short generic caption.
- Do NOT write a witty-only caption.
- Do NOT make it sound like an ad.
- Do NOT overuse hashtags (max 5 total).
- Do NOT include incorrect or unverified science claims.
- Do NOT use markdown bold/italics or emojis anywhere EXCEPT the Section 0 bold title line.
- Embed real "\n" newline characters in the JSON string so the structure renders when displayed.


## PART 2 HOOK

One sentence teasing a deeper pattern without resolving it.

## FACELESS VISUALS (STYLE-LOCKED, MOMENT-VARIED)

Generate EXACTLY 6 faceless visual prompts — one for EACH of these moments, in this exact set:
hook, dangle_1, rehook, dangle_2, verified_truth, close

Each faceless_visuals[i].prompt must be a fully standalone Replicate-ready prompt. Build each one by filling this exact template — replace {subject} with the chosen plant, {moment name} with the moment's display name (Hook, Dangle 1, Re-hook, Dangle 2, Verified Truth, Close), and {moment brief} with that moment's composition brief from the list below. Do not add anything else: no meta instructions, no implementation notes, no explanations of why the plates differ.

Subject: {subject}

Create a vertical 9:16 Architectural Botanical Study Plate of {subject}. Dark charcoal textured paper, near-black parchment, fine grain, soft vignette, cinematic upper-left lighting, muted ivory, bone, warm gray, sage, olive, faded green, and graphite palette. Realistic botanical specimen with museum-grade depth and texture. Architectural blueprint layout with thin construction lines, measurement brackets, scientific annotations, figure labels, and small numeric markers.

Moment: {moment name}
{moment brief}

Avoid people, modern objects, neon, cartoon style, bright colors, glossy ad style, Canva layouts, white backgrounds, clutter, text-heavy graphics, flat sketches, wireframe-only specimens, and line-art-only flowers or leaves.

High-detail editorial botanical plate, premium archival research aesthetic, photorealistic specimen with true texture and depth, 9:16 vertical.

Use the same Architectural Botanical Study Plate style across all six plates. Only the composition and storytelling purpose change.

### Moment Composition Briefs (the ONLY thing that changes between plates)

- hook: Full hero specimen shot from a low camera angle looking slightly up, one large complete botanical subject filling the frame and emerging from darkness. Dramatic, mysterious, scroll-stopping.
- dangle_1: Extreme macro photograph, camera inches from the surface with shallow depth of field. One cropped detail only, such as petal edge, bud texture, seed pod, leaf vein, thorn, root fiber, or stem surface. Never the full plant. Incomplete and suspenseful.
- rehook: Hard diagonal composition, the specimen slashes corner to corner across the frame at a steep 45-degree angle, larger than life scale, deep shadows, high contrast. The most dramatic plate, but still archival.
- dangle_2: Overhead dissection table, top-down flat lay of cross sections, split-open specimen halves, internal anatomy, magnified tissue circles, and numeric markers. No whole intact specimen. Investigative and technical.
- verified_truth: Organized evidence board, top-down view of separated specimen parts laid out in a clean labeled A, B, C, D row: petal, stem segment, bud, leaf, seed, with figure callouts and measurement references. Most structured and credible plate.
- close: Final minimal archive plate, one small clean specimen centered with generous negative space around it, subtle golden-ratio diagram, small archival footer, minimal annotations. Calm, premium, resolved.

Rules:
- Same locked visual style across all 6 plates. Different composition / camera / crop / storytelling purpose per moment, following its brief.
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });

    const corsHeaders = corsHeadersFor(req);
    const __auth = await requireAuthorized(req);
    if (!__auth.ok) return __auth.response;

  try {
    const REPLICATE_API_KEY = await getReplicateApiKey();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Default to Replicate Flux 1.1 Pro for photoreal output.
    // The optional "openai" choice runs gpt-image-2 through Replicate.
    const requestBody = await req.json().catch(() => ({}));
    let imageProvider: "replicate" | "openai" = "replicate";
    if (requestBody?.image_provider === "openai") imageProvider = "openai";
    const animationRowId = typeof requestBody?.animation_row_id === "string"
      ? requestBody.animation_row_id
      : null;
    if (!REPLICATE_API_KEY) {
      throw new Error(
        "REPLICATE_API_KEY not configured — required for Replicate-hosted generation",
      );
    }
    console.log(`Image provider: ${imageProvider}`);


    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (animationRowId && await isStopped(supabase, animationRowId)) {
      throw new Error("Animation run was stopped before content generation");
    }

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

    console.log("Calling Replicate for text content generation...");
    const rawContent = await runReplicateTextCompletion(
      {
        system_instruction: systemPrompt,
        prompt: "Generate a complete botanical content package now.",
        temperature: 0.8,
        max_output_tokens: 8000,
        thinking_budget: 0,
      },
      REPLICATE_API_KEY,
      animationRowId ? { supabase, animationRowId } : undefined,
    );

    if (!rawContent) {
      throw new Error("No content received from AI");
    }
    if (animationRowId && await isStopped(supabase, animationRowId)) {
      throw new Error("Animation run was stopped after content generation");
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
    // Validate required fields — every field must be present and non-empty
    const nonEmpty = (v: unknown) => typeof v === "string" && v.trim().length > 0;
    const missing: string[] = [];
    if (!nonEmpty(parsed.plant_name)) missing.push("plant_name");
    if (!nonEmpty(parsed.verified_fact)) missing.push("verified_fact");
    if (!nonEmpty(parsed.caption)) missing.push("caption");
    if (!nonEmpty(parsed.part2_hook)) missing.push("part2_hook");

    const SCRIPT_KEYS = [
      "hook",
      "dangle_1",
      "rehook",
      "dangle_2",
      "payoff",
      "verified_truth",
      "close",
    ] as const;
    if (!parsed.script || typeof parsed.script !== "object") {
      missing.push("script");
    } else {
      for (const key of SCRIPT_KEYS) {
        if (!nonEmpty(parsed.script[key])) missing.push(`script.${key}`);
      }
    }

    if (!parsed.thumbnail_prompt || typeof parsed.thumbnail_prompt !== "object") {
      missing.push("thumbnail_prompt");
    } else {
      if (parsed.thumbnail_prompt.mode !== "light") {
        missing.push('thumbnail_prompt.mode must be "light"');
      }
      if (!nonEmpty(parsed.thumbnail_prompt.prompt)) missing.push("thumbnail_prompt.prompt");
    }

    if (missing.length > 0) {
      console.error("Missing/invalid fields in parsed content:", missing.join(", "));
      throw new Error(`AI response invalid — missing fields: ${missing.join(", ")}`);
    }


    // Validate faceless_visuals — must be exactly 6, one per required moment
    if (
      !Array.isArray(parsed.faceless_visuals) ||
      parsed.faceless_visuals.length !== REQUIRED_VISUAL_COUNT
    ) {
      console.error(
        "faceless_visuals invalid count:",
        parsed.faceless_visuals?.length,
      );
      throw new Error(
        `faceless_visuals must contain exactly ${REQUIRED_VISUAL_COUNT} items`,
      );
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

    // Novelty guard — fuzzy match so "Hass avocado" still counts as "avocado".
    const norm = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    const candidate = norm(parsed.plant_name ?? "");
    const collision = (recentPlants ?? []).find((p) => {
      const prev = norm(p.plant_name ?? "");
      if (!prev || !candidate) return false;
      // Exact, or either contains the other as a whole word.
      if (prev === candidate) return true;
      return (
        (` ${prev} `).includes(` ${candidate} `) ||
        (` ${candidate} `).includes(` ${prev} `)
      );
    });

    if (collision) {
      console.error(
        "Novelty violation: AI selected recently used plant:",
        parsed.plant_name,
        "matches",
        collision.plant_name,
      );
      throw new Error(
        `Novelty violation: "${parsed.plant_name}" overlaps recently used "${collision.plant_name}". Try again.`,
      );
    }

    // Sort visuals by script order; initialize with status: "queued"
    const visualsInitial = [...parsed.faceless_visuals]
      .sort(
        (a, b) =>
          REQUIRED_MOMENTS.indexOf(a.moment) -
          REQUIRED_MOMENTS.indexOf(b.moment),
      )
      .map((v) => ({
        moment: v.moment,
        prompt: v.prompt,
        image_url: null as string | null,
        status: "queued" as "queued" | "generating" | "done" | "error",
      }));

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

    // Re-read latest row and patch a single visual, preserving siblings' progress
    const mergeVisual = async (
      moment: string,
      patch: {
        image_url?: string | null;
        error?: string | null;
        status?: "queued" | "generating" | "done" | "error";
        started_at?: string | null;
      },
    ) => {
      const { data: currentRow } = await supabase
        .from("botanical_content")
        .select("script_visuals")
        .eq("id", contentId)
        .single();
      let arr = visualsInitial as Array<Record<string, unknown>>;
      if (currentRow?.script_visuals) {
        try {
          arr =
            typeof currentRow.script_visuals === "string"
              ? JSON.parse(currentRow.script_visuals)
              : currentRow.script_visuals;
        } catch {
          /* fallback */
        }
      }
      // Auto-stamp started_at whenever we transition to "generating"
      const fullPatch =
        patch.status === "generating" && patch.started_at === undefined
          ? { ...patch, started_at: new Date().toISOString() }
          : patch;
      const next = arr.map((v) =>
        v.moment === moment ? { ...v, ...fullPatch } : v,
      );
      await supabase
        .from("botanical_content")
        .update({ script_visuals: JSON.stringify(next) })
        .eq("id", contentId);
    };

    const generateOneAttempt = async (
      visual: (typeof visualsInitial)[number],
    ): Promise<{ ok: true } | { ok: false; msg: string }> => {
      try {
        if (animationRowId && await isStopped(supabase, animationRowId)) {
          return { ok: false, msg: "stopped" };
        }
        const imageResult = await generateImageBytes(
          imageProvider,
          visual.prompt,
          REPLICATE_API_KEY,
          animationRowId
            ? {
                supabase,
                animationRowId,
                jobKey: `still:${visual.moment}`,
              }
            : undefined,
        );
        const ext = "jpg";
        const filePath = `${contentId}/${visual.moment}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("botanical-faceless-visuals")
          .upload(filePath, imageResult.bytes, {
            contentType: ext === "jpg" ? "image/jpeg" : "image/png",
            upsert: true,
          });
        if (uploadError) return { ok: false, msg: `upload: ${uploadError.message}` };

        const { data: urlData } = supabase.storage
          .from("botanical-faceless-visuals")
          .getPublicUrl(filePath);

        if (imageResult.jobId) {
          await updateJob(supabase, imageResult.jobId, {
            status: "succeeded",
            output_url: urlData.publicUrl,
            error: null,
          });
        }

        console.log(`Image complete for ${visual.moment}`);
        await mergeVisual(visual.moment, {
          image_url: urlData.publicUrl,
          error: null,
          status: "done",
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, msg: err instanceof Error ? err.message : String(err) };
      }
    };

    const generateOne = async (visual: (typeof visualsInitial)[number]) => {
      await mergeVisual(visual.moment, { status: "generating", error: null });
      const first = await generateOneAttempt(visual);
      if (first.ok) return;
      if (first.msg === "stopped") return;
      console.warn(`Retrying ${visual.moment} after error:`, first.msg);
      await new Promise((r) => setTimeout(r, 4000));
      const second = await generateOneAttempt(visual);
      if (second.ok) return;
      console.error(`Image error for ${visual.moment} after retry:`, second.msg);
      await mergeVisual(visual.moment, {
        image_url: null,
        error: second.msg.slice(0, 240),
        status: "error",
      });
    };

    const runWithConcurrency = async (
      items: typeof visualsInitial,
      limit: number,
    ) => {
      let idx = 0;
      const runners = Array.from(
        { length: Math.min(limit, items.length) },
        async () => {
          while (idx < items.length) {
            const i = idx++;
            await generateOne(items[i]);
          }
        },
      );
      await Promise.all(runners);
    };

    const generateAllImages = async () => {
      console.log(
        `Background: generating ${visualsInitial.length} images via ${imageProvider}...`,
      );
      if (imageProvider === "replicate") {
        // Replicate enforces ~6/min — stagger starts 12s apart.
        const STAGGER_MS = 12000;
        await Promise.all(
          visualsInitial.map((visual, i) =>
            new Promise((resolve) => setTimeout(resolve, i * STAGGER_MS)).then(
              () => generateOne(visual),
            ),
          ),
        );
      } else if (imageProvider === "openai") {
        // gpt-image-2 HQ is slow + tightly rate-limited — cap at 2 concurrent.
        await runWithConcurrency(visualsInitial, 2);
      }
      console.log(`Background image generation complete for ${contentId}`);
    };

    // Fire and forget via EdgeRuntime.waitUntil (keeps function alive)
    // @ts-expect-error EdgeRuntime is available in Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-expect-error EdgeRuntime is available in Supabase edge runtime
      EdgeRuntime.waitUntil(generateAllImages());
    } else {
      // Fallback: run without waiting
      generateAllImages();
    }

    // Return immediately with all 6 visual slots (image_url: null) so UI renders all plates
    parsed.faceless_visuals = visualsInitial;

    return new Response(
      JSON.stringify({
        success: true,
        content: parsed,
        content_id: contentId,
        raw: rawContent,
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Error in generate-botanical-content:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const isCredit = /CREDIT_LIMIT/i.test(message);
    const isRate = /RATE_LIMIT/i.test(message);
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        error_code: isCredit ? "CREDIT_LIMIT" : isRate ? "RATE_LIMIT" : "ERROR",
      }),
      {
        // Return 200 so supabase-js delivers the JSON body to the client
        // instead of throwing a generic "non-2xx" FunctionsHttpError.
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
