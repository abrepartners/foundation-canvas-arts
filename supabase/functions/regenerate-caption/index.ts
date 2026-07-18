// Regenerate the long-form SEO caption for a saved botanical or trend row.
// Uses Lovable AI Gateway and writes back via service role (clients are
// blocked from UPDATE by RLS by design).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";

const ALLOWED_TABLES = new Set(["botanical_content", "trend_content"]);

const CAPTION_SPEC = `You write the "caption" field — the post description published to TikTok and Instagram.

Requirements:
- Length: 175–300 words. Never shorter. Never a witty one-liner.
- Tone: educational, calm, confident, visually descriptive, easy to understand. Reads like a verified science explanation. No hype, no slang, no ad copy, no emojis. Markdown bold (**...**) is allowed ONLY for the Section 0 title line.
- Use real newline characters between sections so the structure renders.

Structure (in this exact order):
0. A bold title line at the very top: a single short headline (4–10 words) naming the surprising angle of the post. Wrap it in **double asterisks** so it renders as bold. No emojis. Only "." or "?" allowed as ending punctuation. Followed by a blank line.
1. A surprising or slightly counterintuitive hook statement about the topic. One short paragraph.
2. A line that says some variation of: "That sounds wrong until you understand how this is actually classified."
3. A paragraph that explains, in plain language, the underlying botanical/scientific principle (structure, development, reproduction — not taste, size, tradition, or kitchen use). Naturally reference phrases like "botanical classification", "plant structure", "plant reproduction", or "common names vs scientific definitions".
4. A short paragraph stating the specific topic fact clearly.
5. The line: "Most confusion about plant facts comes from relying on common names instead of botanical structure."
6. A "This is why:" header followed by EXACTLY 4 bullet lines. Each bullet starts with the en-dash + space: "– ". Each bullet is one concrete fact about the topic.
7. A paragraph reinforcing that botanical classification focuses on anatomy, reproductive structure, and development — not flavor, sweetness, or grocery categories.
8. A paragraph framing the post as part of an ongoing botanical verification series that visually explains plant science concepts that often sound fake but are scientifically accurate.
9. The brand line, on two separate lines, EXACTLY:
My brother studies plants.
I verify the facts.
10. The line: "More verified botanical explanations coming soon."
11. A "Topics covered:" header followed by EXACTLY 6 searchable keyword phrases, one per line, no bullets, no hashtags. Mix general families (botanical classification, plant structure, seeds vs fruits, fruit definitions, plant reproduction, plant anatomy explained, common names vs scientific definitions, how botanists define [topic], why [topic] is classified this way) with topic-specific variants using the actual topic name.
12. EXACTLY 5 hashtags, one per line, each starting with "#", lowercase or camelCase, relevant to the topic and to botany/plant science. No spaces inside a hashtag. Do not exceed 5. Hashtags are MANDATORY — the caption is invalid without exactly 5 hashtag lines at the very end. If unsure, default to: #botany, #plantscience, #plantfacts, #botanicalclassification, plus one topic-specific tag.

Hard rules:
- Do NOT generate a short generic caption.
- Do NOT write a witty-only caption.
- Do NOT make it sound like an ad.
- Do NOT overuse hashtags (max 5 total).
- Do NOT include incorrect or unverified science claims.
- Do NOT use markdown bold/italics or emojis anywhere EXCEPT the Section 0 bold title line.

Return ONLY the caption text. No JSON, no code fences, no preamble, no explanation.`;


async function runReplicateCaption(
  systemInstruction: string,
  prompt: string,
  lovableApiKey: string,
  replicateApiKey: string,
): Promise<string> {
  const GW = "https://connector-gateway.lovable.dev/replicate/v1";
  const createRes = await fetch(`${GW}/models/google/gemini-2.5-flash/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": replicateApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        system_instruction: systemInstruction,
        prompt,
        temperature: 0.7,
        max_output_tokens: 2500,
        thinking_budget: 0,
      },
    }),
  });
  if (!createRes.ok) throw new Error(`Replicate caption failed: ${createRes.status}`);
  const pred = await createRes.json();
  if (!pred.id) throw new Error("Replicate caption failed: no prediction id");
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, i < 5 ? 1000 : 2500));
    const pollRes = await fetch(`${GW}/predictions/${pred.id}`, {
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
        throw new Error("Replicate caption returned empty output");
      }
      return output.trim();
    }
    if (p.status === "failed" || p.status === "canceled") {
      throw new Error(`Replicate caption ${p.status}: ${p.error ?? ""}`);
    }
  }
  throw new Error("Replicate caption timed out");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });

  const corsHeaders = corsHeadersFor(req);
  const json = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  const __auth = await requireAuthorized(req);
  if (!__auth.ok) return __auth.response;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!REPLICATE_API_KEY) throw new Error("REPLICATE_API_KEY not configured");
    if (!SUPABASE_URL || !SERVICE_KEY)
      throw new Error("Supabase credentials not configured");

    const body = await req.json().catch(() => ({}));
    const table = String(body?.table ?? "");
    const id = String(body?.id ?? "");
    if (!ALLOWED_TABLES.has(table)) {
      return json({ error: "Invalid table" }, 400);
    }
    if (!id || id.length < 8) {
      return json({ error: "Missing id" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: row, error: rowErr } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (rowErr) throw new Error(`Row lookup failed: ${rowErr.message}`);
    if (!row) return json({ error: "Row not found" }, 404);

    const topic: string =
      (row as { plant_name?: string }).plant_name ??
      (row as { subject?: string }).subject ??
      "the subject";
    const verifiedFact: string =
      (row as { verified_fact?: string }).verified_fact ?? "";

    let scriptText = "";
    const scriptRaw = (row as { script?: string }).script;
    if (typeof scriptRaw === "string" && scriptRaw.trim().length > 0) {
      try {
        const parsedScript = JSON.parse(scriptRaw);
        scriptText = Object.entries(parsedScript)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
      } catch {
        scriptText = scriptRaw;
      }
    }
    const rawContent: string = (row as { raw_content?: string }).raw_content ?? "";

    const userPrompt = [
      `Topic: ${topic}`,
      verifiedFact ? `Verified fact: ${verifiedFact}` : "",
      scriptText ? `Script beats:\n${scriptText}` : "",
      !scriptText && rawContent ? `Reference notes:\n${rawContent.slice(0, 2000)}` : "",
      "",
      "Write the long-form SEO caption following the spec exactly. Return only the caption text.",
    ]
      .filter(Boolean)
      .join("\n\n");

    let caption = await runReplicateCaption(
      CAPTION_SPEC,
      userPrompt,
      LOVABLE_API_KEY,
      REPLICATE_API_KEY,
    );
    if (!caption) return json({ error: "Empty AI response" }, 502);

    // Strip accidental fences
    if (caption.startsWith("```")) {
      caption = caption.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
    }

    const { error: updErr } = await supabase
      .from(table)
      .update({ caption })
      .eq("id", id);
    if (updErr) throw new Error(`Update failed: ${updErr.message}`);

    return json({ ok: true, caption });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("regenerate-caption error:", msg);
    return json({ error: msg }, 500);
  }
});
