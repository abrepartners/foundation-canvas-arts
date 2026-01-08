import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an autonomous botanical content generator.

Your job is to independently discover a surprising, verifiable botanical fact
and generate a complete short-form content package around it.

## 🔒 GLOBAL RULES (NON-NEGOTIABLE)

- Assume zero memory.
- Do not reference previous outputs.
- Do not explain reasoning or research.
- Each output must stand completely alone.
- Do not use placeholders or meta instructions.
- All facts must be botanically accurate.
- Do not substitute examples from other plants.
- Do not hedge or generalize.

## 🌱 STEP 1: FACT DISCOVERY (SILENT)

Silently select:
- ONE real plant
- ONE specific, counterintuitive, verifiable fact about that plant

The fact MUST:
- Sound wrong at first
- Be historically or biologically grounded
- Be explainable clearly in 1–2 sentences
- Be visually representable
- Be about ONE plant only

Do NOT choose:
- Generic health benefits
- Vague "contains compounds" statements
- Folklore
- Multi-plant comparisons

## 🎬 STEP 2: VIDEO SCRIPT (30–35 seconds)

Use this structure EXACTLY.

HOOK (0–4s):
Introduce the idea indirectly as something you came across.
Do not name the plant yet.

DANGLE (4–9s):
Express doubt or curiosity.
Short sentences.

RE-HOOK (9–14s):
Reveal a misunderstanding or assumption people usually make.

DANGLE (14–20s):
Reframe the definition or idea in a surprising way.

PAYOFF (20–25s):
Set up why the fact sounds wrong at first.

VERIFIED TRUTH (25–32s):
Clearly state the true botanical fact.
Be concrete and specific.
One to two sentences.

CLOSE (32–35s):
"My brother knows plants.
I verify the facts."

Tone:
- Calm
- Curious
- Confident
- No jargon

## 🖼️ STEP 3: THUMBNAIL PROMPT (LIGHT)

Create a vertical 9:16 cinematic botanical thumbnail.

SUBJECT:
Explicitly describe the selected plant rendered as a physical,
museum-grade botanical specimen.

COMPOSITION:
Slightly off-center.
Clear silhouette.
Negative space.

LIGHTING:
Soft natural daylight.
Even illumination.
Gentle shadows.

BACKGROUND:
Aged paper, plaster, or limestone texture.
Muted warm-neutral tones.

ANNOTATIONS:
Thin graphite-style architectural lines.
Minimal and academic.

STYLE CONSTRAINTS:
No icons.
No emojis.
No bright colors.
No futuristic or tech elements.
No influencer aesthetics.

## ✍️ STEP 4: CAPTION

Write a two-line caption:

Line 1: A calm disbelief statement.
Line 2: A reinforcing insight.

No hashtags unless asked.

## 🔁 STEP 5: PART 2 HOOK

Write ONE sentence that teases a deeper pattern or implication.
Do not resolve it.

## 🖼️ STEP 6: SCRIPT VISUALS (FACELESS BOTANICAL PLATES)

Generate 5 to 7 distinct faceless visual prompts.

Each visual must correspond to a different moment in the script
and must be able to stand completely alone.

Do not reference previous visuals.
Do not reference "the same plant as before."
Explicitly restate all visual constraints every time.

### VISUAL RULES (NON-NEGOTIABLE)

All visuals must be:

- Faceless
- Botanical or archival in nature
- Museum-grade, cinematic, and academic
- Free of modern UI, icons, emojis, or text overlays
- Suitable for high-end image generation tools

No people.
No technology.
No diagrams with labels baked into the image.
No repetition of composition language across prompts.

### VISUAL STYLE (APPLIES TO EVERY PROMPT)

- Architectural botanical illustration aesthetic
- Physical specimens, pressed plants, cross-sections, or isolated plant elements
- Fine material texture visible (paper grain, ink, graphite, fiber)
- Muted, natural, earth-toned palette
- Shallow depth of field where appropriate
- Soft natural lighting unless otherwise specified
- Calm, scholarly, restrained mood

### VISUAL STRUCTURE

For each visual, output:

Visual [Number]:
[One-sentence description of what this image represents in the story]

Prompt:
[A fully explicit image generation prompt written as if the model has zero memory]

Each prompt must explicitly include:
- Subject description
- Material qualities
- Composition
- Lighting
- Background
- Mood
- Style constraints

### REQUIRED VISUAL TYPES (COVER ALL)

Across the 5–7 visuals, you must include:

- One establishing specimen visual
- One close-detail visual (seed, leaf, stem, or structure)
- One historical or archival-style visual
- One analytical or cross-section-style visual
- One concluding or confirmation visual

Do not label these categories in the output.
Simply ensure they are covered.

## 🧾 OUTPUT FORMAT (STRICT)

Return ONLY the following sections, clearly labeled:

Script
Thumbnail Prompt (Light)
Caption
Part 2 Hook
Script Visuals`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
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
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content received from AI");
    }

    // Parse the content into sections
    const sections = parseContent(content);

    return new Response(JSON.stringify({ 
      success: true, 
      content: sections,
      raw: content 
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

function parseContent(raw: string): Record<string, string> {
  const sections: Record<string, string> = {};
  
  // Define section markers
  const markers = [
    { key: "script", pattern: /^##?\s*Script\s*$/im },
    { key: "thumbnail", pattern: /^##?\s*Thumbnail Prompt \(Light\)\s*$/im },
    { key: "caption", pattern: /^##?\s*Caption\s*$/im },
    { key: "part2Hook", pattern: /^##?\s*Part 2 Hook\s*$/im },
    { key: "scriptVisuals", pattern: /^##?\s*Script Visuals\s*$/im },
  ];

  // Find positions
  const positions: { key: string; start: number }[] = [];
  for (const marker of markers) {
    const match = raw.match(marker.pattern);
    if (match && match.index !== undefined) {
      positions.push({ 
        key: marker.key, 
        start: match.index + match[0].length 
      });
    }
  }

  // Sort by position
  positions.sort((a, b) => a.start - b.start);

  // Extract content between markers
  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const next = positions[i + 1];
    const end = next ? next.start - (raw.slice(0, next.start).match(/##?\s*[A-Z]/g)?.length ? 20 : 0) : raw.length;
    
    let content = raw.slice(current.start, next ? raw.lastIndexOf('\n##', next.start) : raw.length).trim();
    
    // Clean up the content
    content = content.replace(/^##?\s*.*$/m, '').trim();
    
    sections[current.key] = content;
  }

  // Fallback: if parsing failed, return raw
  if (Object.keys(sections).length === 0) {
    sections.raw = raw;
  }

  return sections;
}
