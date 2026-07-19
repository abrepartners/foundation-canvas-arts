import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";

async function fallbackViaGemini(
  subject: string,
  lovableApiKey: string,
  replicateApiKey: string,
): Promise<string[]> {
  const sys = `You return ONLY a JSON array of 8 short trending TikTok-style topic keywords (2-5 words each) related to the user subject. No markdown, no commentary, no object — just the array.`;
  const GW = "https://api.replicate.com/v1";
  const createRes = await fetch(
    `${GW}/models/google/gemini-2.5-flash/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          system_instruction: sys,
          prompt: subject
            ? `Subject: ${subject}`
            : "Subject: currently trending TikTok topics across all categories",
          temperature: 0.9,
          max_output_tokens: 600,
          thinking_budget: 0,
        },
      }),
    },
  );
  if (!createRes.ok) throw new Error(`Replicate suggestions failed: ${createRes.status}`);
  const pred = await createRes.json();
  if (!pred.id) throw new Error("Replicate suggestions failed: no prediction id");
  let raw = "[]";
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, i < 5 ? 1000 : 2500));
    const pollRes = await fetch(`${GW}/predictions/${pred.id}`, {
      headers: { Authorization: `Bearer ${replicateApiKey}` },
    });
    if (!pollRes.ok) continue;
    const p = await pollRes.json();
    if (p.status === "succeeded") {
      raw = Array.isArray(p.output) ? p.output.join("") : String(p.output ?? "[]");
      break;
    }
    if (p.status === "failed" || p.status === "canceled") {
      throw new Error(`Replicate suggestions ${p.status}: ${p.error ?? ""}`);
    }
  }
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  try {
    const arr = JSON.parse(cleaned.trim());
    if (Array.isArray(arr)) {
      return arr
        .map((t) => String(t).trim())
        .filter((t) => t.length > 0)
        .slice(0, 10);
    }
  } catch {
    /* ignore */
  }
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });

    const corsHeaders = corsHeadersFor(req);
    const __auth = await requireAuthorized(req);
    if (!__auth.ok) return __auth.response;

  try {
    const LOVABLE_API_KEY = "";
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) throw new Error("REPLICATE_API_KEY not configured");

    let subject = "";
    try {
      const body = await req.json();
      subject = String(body?.subject ?? "").trim().slice(0, 120);
    } catch {
      /* empty body */
    }

    let topics: string[] | null = null;
    const source = "gemini";

    if (!topics || topics.length === 0) {
      topics = await fallbackViaGemini(subject, LOVABLE_API_KEY, REPLICATE_API_KEY);
    }

    return new Response(
      JSON.stringify({ success: true, topics, source }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message, topics: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
