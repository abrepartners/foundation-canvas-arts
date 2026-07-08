import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";

async function fallbackViaGemini(
  subject: string,
  lovableApiKey: string,
  replicateApiKey: string,
): Promise<string[]> {
  const sys = `You return ONLY a JSON array of 8 short trending TikTok-style topic keywords (2-5 words each) related to the user subject. No markdown, no commentary, no object — just the array.`;
  const GW = "https://connector-gateway.lovable.dev/replicate/v1";
  const createRes = await fetch(
    `${GW}/models/google/gemini-2.5-flash/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": replicateApiKey,
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
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": replicateApiKey,
      },
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

async function tiktokInsights(
  subject: string,
  lovableApiKey: string,
  tiktokApiKey: string,
): Promise<string[] | null> {
  try {
    const url = `https://connector-gateway.lovable.dev/tiktok/research/topic/keywords/?keyword=${encodeURIComponent(subject || "trending")}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": tiktokApiKey,
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const list =
      json?.data?.keywords ??
      json?.data?.list ??
      json?.keywords ??
      json?.list ??
      [];
    if (!Array.isArray(list) || list.length === 0) return null;
    return list
      .map((item: unknown) =>
        typeof item === "string"
          ? item
          : String((item as { keyword?: string; name?: string })?.keyword ??
              (item as { name?: string })?.name ??
              ""),
      )
      .filter((s: string) => s.trim().length > 0)
      .slice(0, 10);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });

    const corsHeaders = corsHeadersFor(req);
    const __auth = await requireAuthorized(req);
    if (!__auth.ok) return __auth.response;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TIKTOK_API_KEY = Deno.env.get("TIKTOK_API_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!REPLICATE_API_KEY) throw new Error("REPLICATE_API_KEY not configured");

    let subject = "";
    try {
      const body = await req.json();
      subject = String(body?.subject ?? "").trim().slice(0, 120);
    } catch {
      /* empty body */
    }

    let topics: string[] | null = null;
    let source = "gemini";

    if (TIKTOK_API_KEY) {
      const t = await tiktokInsights(subject, LOVABLE_API_KEY, TIKTOK_API_KEY);
      if (t && t.length > 0) {
        topics = t;
        source = "tiktok";
      }
    }

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
