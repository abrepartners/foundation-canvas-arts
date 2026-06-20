import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Run a Replicate prediction for any official model, return output URL.
async function runReplicatePrediction(
  model: string,
  input: Record<string, unknown>,
  lovableApiKey: string,
  replicateApiKey: string,
): Promise<string> {
  const GW = "https://connector-gateway.lovable.dev/replicate/v1";
  const authHeaders = {
    Authorization: `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": replicateApiKey,
    "Content-Type": "application/json",
  };

  let createRes: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
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
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": replicateApiKey,
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
  lovableApiKey: string,
  replicateApiKey: string,
): Promise<string> {
  const GW = "https://connector-gateway.lovable.dev/replicate/v1";
  const model = "google/gemini-2.5-flash";
  const createRes = await fetch(`${GW}/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": replicateApiKey,
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
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": replicateApiKey,
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

// Generate an image and return raw bytes. Supports three providers.
async function generateImageBytes(
  provider: "lovable" | "replicate" | "openai",
  prompt: string,
  lovableApiKey: string,
  replicateApiKey: string | undefined,
): Promise<Uint8Array> {
  if (provider === "openai" || provider === "replicate") {
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
    const url = await runReplicatePrediction(
      model,
      input,
      lovableApiKey,
      replicateApiKey,
    );
    const imgRes = await fetch(url);
    if (!imgRes.ok)
      throw new Error(`Replicate image fetch failed: ${imgRes.status}`);
    return new Uint8Array(await imgRes.arrayBuffer());
  }

  const imageResponse = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    },
  );
  if (!imageResponse.ok) {
    throw new Error(`Lovable image API error: ${imageResponse.status}`);
  }
  const imageData = await imageResponse.json();
  const base64Image =
    imageData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!base64Image || typeof base64Image !== "string") {
    throw new Error("No image data from Lovable AI");
  }
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
  return Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
}

const EXCLUDE_COUNT = 5;
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
  subject: string,
  noveltyBlock: string,
) => `You are a zero-memory verified-fact discovery engine.

The user has chosen the subject: ${subject}

${noveltyBlock}

You MUST return valid JSON.
Do NOT include markdown.
Do NOT include explanations.
Do NOT include extra keys.
Do NOT include text outside the JSON object.

If you cannot comply, return an empty JSON object: {}

## FACT DISCOVERY RULES

Select ONE specific, counterintuitive, verifiable fact about the subject "${subject}" that:
- Sounds wrong at first
- Is historically, scientifically, or culturally grounded (real and checkable)
- Is explainable clearly in 1-2 sentences
- Is visually representable

Do NOT choose: generic clichés, vague claims, folklore presented as fact, or multi-topic comparisons.

The "plant_name" field in the output schema MUST be repurposed as the SPECIFIC noun/topic chosen within the subject (e.g. for subject "octopuses" -> "Pacific Striped Octopus"; for subject "Roman history" -> "Roman concrete"). Keep it short and concrete.

## SCRIPT STRUCTURE (30-35 seconds)

- hook: Introduce the idea indirectly (0-4s)
- dangle_1: Express doubt or curiosity (4-9s)
- rehook: Reveal a common misunderstanding (9-14s)
- dangle_2: Reframe the idea surprisingly (14-20s)
- payoff: Set up why the fact sounds wrong (20-25s)
- verified_truth: State the true fact concretely (25-32s)
- close: Always end with "My brother knows things. I verify the facts." (32-35s)

Do NOT include section labels or timing labels inside the script text. Output only the spoken words for each section.

Tone: Calm, curious, confident, no jargon.

## THUMBNAIL PROMPT (CINEMATIC EDUCATIONAL THUMBNAIL SYSTEM)

Generate a complete, self-contained vertical 9:16 thumbnail prompt that follows this exact system:

CORE IDENTITY:
- Cinematic mood, museum/archive aesthetic
- Architectural editorial design language
- Emotional tension and intellectual curiosity
- Institutional credibility — feels like a documentary frame or research archive panel

COMPOSITION:
- Large focal subject as a museum-grade specimen or artifact
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
- Headline creates a question, not the answer
  (e.g. "NOT WHAT YOU THINK", "MOST PEOPLE GET THIS WRONG", "THE REAL DIFFERENCE")

NEVER INCLUDE:
- Emojis, neon colors, cartoon styling, futuristic interfaces
- Gaming aesthetics, influencer-style effects, busy infographics
- Modern social-media aesthetics

The prompt MUST be fully self-contained (zero memory): restate subject, lighting, palette, composition, typography, and constraints every time.

## CAPTION (SEO long-form, replaces any short caption)

The "caption" field MUST be a long-form, SEO-structured educational caption written in the calm "verified explanation" voice. This caption is published as the post description on TikTok and Instagram, so it must be search-friendly while still sounding natural and human.

Length: 175–300 words. Not shorter. Not a witty one-liner.

Tone: educational, calm, confident, visually descriptive, easy to understand. Reads like a verified science explanation. Never hype, never slang, never ad copy, never emojis.

Structure (follow in this exact order, with blank lines between sections, using real newline characters \n inside the JSON string):

0. A bold title line at the very top: a single short headline (4–10 words) naming the surprising angle of the post. Wrap it in **double asterisks** so it renders as bold. No emojis. Only "." or "?" allowed as ending punctuation. Followed by a blank line. This is the ONLY place markdown bold is allowed.
1. A strong, surprising or slightly counterintuitive hook statement about the selected topic. One short paragraph.
2. A line that says some variation of: "That sounds wrong until you understand how this is actually classified."
3. A paragraph that explains, in plain language, the underlying scientific or structural principle at play (anatomy, development, mechanism — not popular usage or convenience). Reference botanical/scientific classification, structure, or "common names vs scientific definitions" naturally where the topic allows.
4. A short paragraph stating the specific topic fact clearly.
5. The line: "Most confusion about this topic comes from relying on common names instead of how it is actually structured."
6. A "This is why:" header followed by EXACTLY 4 bullet lines. Each bullet starts with the en-dash + space: "– ". Each bullet is one concrete fact about the chosen topic.
7. A paragraph reinforcing that real classification focuses on structure, mechanism, and development — not flavor, popularity, or marketing categories.
8. A paragraph framing the post as part of an ongoing verification series that visually explains concepts that often sound fake but are scientifically accurate.
9. The brand line, on two separate lines, EXACTLY:
My brother studies plants.
I verify the facts.
10. The line: "More verified explanations coming soon."
11. A "Topics covered:" header followed by EXACTLY 6 searchable keyword phrases, one per line, no bullets, no hashtags. Mix general families (botanical classification, plant structure, plant anatomy explained, common names vs scientific definitions, how botanists define [topic], why [topic] is classified this way) with topic-specific variants using the actual topic name.
12. EXACTLY 5 hashtags, one per line, each starting with "#", lowercase or camelCase, relevant to the topic and to plant/science. No spaces inside a hashtag. Do not exceed 5. Hashtags are MANDATORY — the caption is invalid without exactly 5 hashtag lines at the very end. If unsure, default to: #botany, #plantscience, #plantfacts, #botanicalclassification, plus one topic-specific tag.

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

Each faceless_visuals[i].prompt must be a fully standalone Replicate-ready prompt. Build each one by filling this exact template — replace {topic} with the specific noun/topic you selected, {moment name} with the moment's display name (Hook, Dangle 1, Re-hook, Dangle 2, Verified Truth, Close), and {moment brief} with that moment's composition brief from the list below. Do not add anything else.

Topic: {topic}

Create a vertical 9:16 Architectural Study Plate of {topic}. Dark charcoal textured paper, near-black parchment, fine grain, soft vignette, cinematic upper-left lighting, muted ivory, bone, warm gray, sage, olive, faded green, and graphite palette. Realistic specimen or artifact with museum-grade depth and texture. Architectural blueprint layout with thin construction lines, measurement brackets, scholarly annotations, figure labels, and small numeric markers.

Moment: {moment name}
{moment brief}

Avoid people, modern objects, neon, cartoon style, bright colors, glossy ad style, Canva layouts, white backgrounds, clutter, text-heavy graphics, flat sketches, wireframe-only specimens.

High-detail editorial study plate, premium archival research aesthetic, photorealistic specimen/artifact with true texture and depth, 9:16 vertical.

Use the same Architectural Study Plate style across all six plates. Only the composition and storytelling purpose change.

### Moment Composition Briefs (the ONLY thing that changes between plates)

- hook: Full hero shot from a low camera angle looking slightly up, one large complete subject filling the frame and emerging from darkness. Dramatic, mysterious, scroll-stopping.
- dangle_1: Extreme macro photograph, camera inches from the surface with shallow depth of field. One cropped detail only. Never the full subject. Incomplete and suspenseful.
- rehook: Hard diagonal composition, the subject slashes corner to corner across the frame at a steep 45-degree angle, larger than life scale, deep shadows, high contrast. The most dramatic plate, but still archival.
- dangle_2: Overhead dissection or exploded-view table, top-down flat lay of cross sections, split-open parts, internal anatomy or interior structure, magnified circles, and numeric markers. No whole intact subject. Investigative and technical.
- verified_truth: Organized evidence board, top-down view of separated parts laid out in a clean labeled A, B, C, D row, with figure callouts and measurement references. Most structured and credible plate.
- close: Final minimal archive plate, one small clean subject centered with generous negative space around it, subtle golden-ratio diagram, small archival footer, minimal annotations. Calm, premium, resolved.

Rules:
- Same locked visual style across all 6 plates.
- Exactly 6 visuals — NO MORE, NO LESS. NO duplicate moments.
- Each visual MUST map to a DIFFERENT script moment.
- The topic is dynamic — use what you selected for this package.

Return ONLY this exact JSON structure:
{
  "plant_name": "string - the specific topic chosen within the subject",
  "verified_fact": "string - the core fact in one sentence",
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

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    let body: { subject?: string; image_provider?: string } = {};
    try {
      body = await req.json();
    } catch {
      /* empty body */
    }

    const subject = (body.subject ?? "").trim();
    if (!subject || subject.length < 2 || subject.length > 120) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "subject is required (2-120 chars)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let imageProvider: "lovable" | "replicate" | "openai" = "replicate";
    if (body.image_provider === "lovable") imageProvider = "lovable";
    else if (body.image_provider === "openai") imageProvider = "openai";
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY not configured — required for Replicate-hosted generation");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: recentRows } = await supabase
      .from("trend_content")
      .select("subject")
      .not("subject", "is", null)
      .order("created_at", { ascending: false })
      .limit(EXCLUDE_COUNT);

    const recentList = (recentRows ?? [])
      .map((row) => `- ${row.subject}`)
      .join("\n");

    const NOVELTY_BLOCK = `
TOPIC SELECTION CONSTRAINT (MANDATORY):

You must pick a specific topic within "${subject}" that does NOT closely match anything in the list below.

Recently used topics:
${recentList || "- (none)"}

Rules:
- Choose a different specific angle/topic within the subject.
- Do NOT repeat or rephrase.
- Novelty is REQUIRED.
`;

    const systemPrompt = buildSystemPrompt(subject, NOVELTY_BLOCK);

    const rawContent = await runReplicateTextCompletion(
      {
        system_instruction: systemPrompt,
        prompt: `Generate a complete content package for the subject: ${subject}`,
        temperature: 0.8,
        max_output_tokens: 8000,
        thinking_budget: 0,
      },
      LOVABLE_API_KEY,
      REPLICATE_API_KEY,
    );
    if (!rawContent) throw new Error("No content received from AI");

    let parsed: Record<string, unknown> & {
      faceless_visuals?: Array<{ moment: string; prompt: string }>;
      [k: string]: unknown;
    };
    try {
      let cleaned = rawContent.trim();
      if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
      else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
      parsed = JSON.parse(cleaned.trim());
    } catch (e) {
      console.error("JSON parse failed:", e);
      throw new Error("AI returned invalid JSON");
    }

    if (!parsed.plant_name || !parsed.script || !parsed.thumbnail_prompt) {
      throw new Error("AI response missing required fields");
    }

    if (
      !Array.isArray(parsed.faceless_visuals) ||
      parsed.faceless_visuals.length !== REQUIRED_VISUAL_COUNT
    ) {
      throw new Error(
        `faceless_visuals must contain exactly ${REQUIRED_VISUAL_COUNT} items`,
      );
    }

    const usedMoments = new Set<string>();
    for (const visual of parsed.faceless_visuals) {
      if (!visual.moment || !visual.prompt) {
        throw new Error("Each faceless_visual must have moment and prompt");
      }
      if (!REQUIRED_MOMENTS.includes(visual.moment as typeof REQUIRED_MOMENTS[number])) {
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

    const visualsInitial = [...parsed.faceless_visuals]
      .sort(
        (a, b) =>
          REQUIRED_MOMENTS.indexOf(a.moment as typeof REQUIRED_MOMENTS[number]) -
          REQUIRED_MOMENTS.indexOf(b.moment as typeof REQUIRED_MOMENTS[number]),
      )
      .map((v) => ({
        moment: v.moment,
        prompt: v.prompt,
        image_url: null as string | null,
        status: "queued" as "queued" | "generating" | "done" | "error",
      }));

    const { data: insertedRow, error: insertError } = await supabase
      .from("trend_content")
      .insert({
        subject: String(parsed.plant_name),
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

    const mergeVisual = async (
      moment: string,
      patch: {
        image_url?: string | null;
        error?: string | null;
        status?: "queued" | "generating" | "done" | "error";
      },
    ) => {
      const { data: currentRow } = await supabase
        .from("trend_content")
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
      const next = arr.map((v) =>
        v.moment === moment ? { ...v, ...patch } : v,
      );
      await supabase
        .from("trend_content")
        .update({ script_visuals: JSON.stringify(next) })
        .eq("id", contentId);
    };

    const generateOne = async (visual: (typeof visualsInitial)[number]) => {
      await mergeVisual(visual.moment, { status: "generating", error: null });
      try {
        const imageBuffer = await generateImageBytes(
          imageProvider,
          visual.prompt,
          LOVABLE_API_KEY,
          REPLICATE_API_KEY,
        );
        const ext = imageProvider === "lovable" ? "png" : "jpg";
        const filePath = `trends/${contentId}/${visual.moment}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("botanical-faceless-visuals")
          .upload(filePath, imageBuffer, {
            contentType: ext === "jpg" ? "image/jpeg" : "image/png",
            upsert: true,
          });
        if (uploadError) {
          await mergeVisual(visual.moment, {
            image_url: null,
            error: `upload: ${uploadError.message}`,
            status: "error",
          });
          return;
        }
        const { data: urlData } = supabase.storage
          .from("botanical-faceless-visuals")
          .getPublicUrl(filePath);
        await mergeVisual(visual.moment, {
          image_url: urlData.publicUrl,
          error: null,
          status: "done",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await mergeVisual(visual.moment, {
          image_url: null,
          error: msg.slice(0, 240),
          status: "error",
        });
      }
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
      if (imageProvider === "replicate") {
        const STAGGER_MS = 12000;
        await Promise.all(
          visualsInitial.map((visual, i) =>
            new Promise((resolve) => setTimeout(resolve, i * STAGGER_MS)).then(
              () => generateOne(visual),
            ),
          ),
        );
      } else if (imageProvider === "openai") {
        await runWithConcurrency(visualsInitial, 2);
      } else {
        await Promise.all(visualsInitial.map((v) => generateOne(v)));
      }
    };

    // @ts-ignore EdgeRuntime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(generateAllImages());
    } else {
      generateAllImages();
    }

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
    console.error("Error in generate-trend-content:", error);
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
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
