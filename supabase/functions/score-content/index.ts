import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";

const SYSTEM = `You are a TikTok virality analyst for short-form educational/botanical content.

You will receive: a hook (first 0–4s spoken line), the verified fact, and the caption title.
Rate the hook on a 0–100 scale for short-form virality, weighting:
- First-3-words punch (does it stop a scroll?)
- Curiosity gap (does it withhold the answer?)
- Length (ideal 6–14 spoken words, under 4 seconds)
- Concreteness (specific subject, not vague)
- Pattern interrupt or contradiction

Then write TWO alternate hook rewrites that score higher. Each rewrite must:
- Stay factually consistent with the verified fact
- Be 6–14 words
- Open with a punchy first 3 words (no "Did you know", no "Let me tell you")
- Create curiosity without revealing the payoff
- Match the calm, skeptical, non-performative voice ("My brother knows plants. I verify the facts.")

Return ONLY valid JSON, no markdown, no prose:
{
  "score": 0-100 integer,
  "reasoning": "one sentence, under 25 words, naming the biggest strength or weakness",
  "variants": ["rewrite 1", "rewrite 2"]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });

    const corsHeaders = corsHeadersFor(req);
    const __auth = await requireAuthorized(req);
    if (!__auth.ok) return __auth.response;

  try {
    const body = await req.json();
    if (body?.__ping) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { content_id } = body;
    if (!content_id) {
      return new Response(JSON.stringify({ error: "content_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error: fetchErr } = await supabase
      .from("botanical_content")
      .select("id, plant_name, verified_fact, script, caption")
      .eq("id", content_id)
      .maybeSingle();

    if (fetchErr || !row) {
      return new Response(JSON.stringify({ error: "content not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let script: any = row.script;
    if (typeof script === "string") {
      try { script = JSON.parse(script); } catch { script = {}; }
    }
    const hook = script?.hook ?? "";
    const captionFirstLine = (row.caption ?? "").split("\n").find((l: string) => l.trim().startsWith("**"))?.replace(/\*\*/g, "").trim() ?? "";

    const userPrompt = `Hook: ${hook}
Verified fact: ${row.verified_fact ?? ""}
Caption title: ${captionFirstLine}
Plant: ${row.plant_name ?? ""}`;

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY missing");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "RATE_LIMIT" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "CREDIT_LIMIT" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error ${aiRes.status}: ${txt}`);
    }

    const json = await aiRes.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      parsed = {};
    }

    const score = Math.max(0, Math.min(100, parseInt(parsed.score, 10) || 0));
    const reasoning = String(parsed.reasoning ?? "").slice(0, 280);
    const variants = Array.isArray(parsed.variants)
      ? parsed.variants.slice(0, 2).map((v: any) => String(v).slice(0, 280))
      : [];

    const { error: updateErr } = await supabase
      .from("botanical_content")
      .update({
        virality_score: score,
        score_reasoning: reasoning,
        hook_variants: variants,
      })
      .eq("id", content_id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ score, reasoning, variants }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("score-content error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
