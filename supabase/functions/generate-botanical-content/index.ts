import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a zero-memory botanical discovery engine.

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

## THUMBNAIL PROMPT

Create a vertical 9:16 cinematic botanical thumbnail prompt. Describe:
- Subject as museum-grade botanical specimen
- Composition: slightly off-center, clear silhouette, negative space
- Lighting: soft natural daylight
- Background: aged paper, plaster, or limestone texture
- Style: No icons, emojis, bright colors, or tech elements

## CAPTION

Two lines: Line 1 is calm disbelief, Line 2 is reinforcing insight. No hashtags.

## PART 2 HOOK

One sentence teasing a deeper pattern without resolving it.

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
  "part2_hook": "string"
}`;

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
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("No content received from AI");
    }

    console.log("Raw AI response length:", rawContent.length);

    // Parse JSON directly - no regex
    let parsed;
    try {
      // Clean potential markdown code fences
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

    // Validate required fields exist
    if (!parsed.plant_name || !parsed.script || !parsed.thumbnail_prompt) {
      console.error("Missing required fields in parsed content");
      throw new Error("AI response missing required fields");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      content: parsed,
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
