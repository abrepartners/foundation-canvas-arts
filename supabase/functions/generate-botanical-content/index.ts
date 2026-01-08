import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a botanical content generator for a verification-focused channel. The channel voice is calm, curious, skeptical, and observational.

CRITICAL RULES:
- Assume zero memory. Each generation is independent.
- All factual verification must relate strictly to the specified botanical subject.
- Do NOT substitute examples, compounds, or historical uses from other plants.
- Do NOT repeat the input claim verbatim anywhere. Only reference it indirectly or paraphrased.
- Never describe research or investigation. Only output final conclusions.
- Use short sentences, plain language, calm curious tone, no jargon.

You will generate 4 assets based on the inputs. Return ONLY valid JSON with this exact structure:
{
  "script": "the full video script",
  "thumbnailPrompt": "the thumbnail generation prompt",
  "caption": "the social caption",
  "part2Hook": "the part 2 hook sentence"
}`;

function buildUserPrompt(botanicalSubject: string, claimToVerify: string, thumbnailMode: "Light" | "Dark"): string {
  const thumbnailInstructions = thumbnailMode === "Light" 
    ? `LIGHT THUMBNAIL PROMPT: Create a vertical 9:16 cinematic botanical thumbnail.
- SUBJECT: Realistic ${botanicalSubject} specimen as a physical, museum-grade pressed botanical object
- COMPOSITION: Subject slightly off-center with clear silhouette and negative space
- LIGHTING: Soft natural daylight, even illumination, gentle shadows
- BACKGROUND: Light architectural surface (aged paper, plaster, limestone). Muted warm-neutral tones.
- ANNOTATIONS: Thin graphite-style architectural lines, minimal academic marks
- MOOD: Clear, calm, intellectual, trustworthy
- CONSTRAINTS: No icons, emojis, bright colors, futuristic elements, influencer aesthetics`
    : `DARK THUMBNAIL PROMPT: Create a vertical 9:16 dark cinematic botanical thumbnail.
- SUBJECT: Realistic ${botanicalSubject} specimen as a physical museum-grade pressed botanical object
- COMPOSITION: Tighter framing, strong foreground presence, partial crop allowed
- LIGHTING: Low-key cinematic, single directional light, deep shadows with soft transitions
- BACKGROUND: Dark architectural surface (charcoal, umber, deep taupe). Subtle texture.
- ANNOTATIONS: Minimal lines in muted chalk or aged graphite tones
- MOOD: Mysterious, investigative, restrained, intellectual
- CONSTRAINTS: No icons, emojis, bright colors, futuristic or sci-fi elements`;

  return `Generate botanical content for:

BOTANICAL SUBJECT: ${botanicalSubject}
CLAIM TO VERIFY: ${claimToVerify}
THUMBNAIL MODE: ${thumbnailMode}

VIDEO SCRIPT STRUCTURE (30-35 seconds):
- HOOK (0-4s): State the claim indirectly. Do NOT repeat verbatim. Do NOT use "my brother says/told me." Reframe as something heard or discovered.
- DANGLE (4-9s): Express disbelief or curiosity
- RE-HOOK (9-14s): Reveal a misunderstanding or assumption
- DANGLE (14-20s): Reframe the definition or concept
- PAYOFF (20-25s): Frame why the claim sounds wrong at first
- VERIFIED TRUTH (25-32s): Deliver the verified botanical fact directly. State truth in 1-2 simple sentences. Research already done.
- CLOSE (32-35s): "My brother knows plants. I verify the facts."

${thumbnailInstructions}

CAPTION: Write 2 lines max. Short disbelief statement + one reinforcing insight. Calm, observational tone. No hashtags.

PART 2 HOOK: Single open-loop sentence teasing a deeper implication. Do not resolve the idea.

Generate content grounded in real botanical research about ${botanicalSubject}. Reference actual compounds, traditional uses, or scientific findings specific to this plant.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { botanicalSubject, claimToVerify, thumbnailMode } = await req.json();

    if (!botanicalSubject || !claimToVerify || !thumbnailMode) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating content for:", { botanicalSubject, claimToVerify, thumbnailMode });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(botanicalSubject, claimToVerify, thumbnailMode) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content;

    if (!generatedText) {
      console.error("No content in AI response:", data);
      return new Response(
        JSON.stringify({ error: "No content generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI response received successfully");
    
    const parsedContent = JSON.parse(generatedText);

    return new Response(
      JSON.stringify({
        script: parsedContent.script,
        thumbnailPrompt: parsedContent.thumbnailPrompt,
        caption: parsedContent.caption,
        part2Hook: parsedContent.part2Hook,
        thumbnailMode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-botanical-content:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
