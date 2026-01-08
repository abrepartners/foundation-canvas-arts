import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const systemPrompt = `You are an autonomous botanical content generator.

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

Create a vertical 9:16 cinematic botanical thumbnail prompt.

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

No hashtags.

## 🔁 STEP 5: PART 2 HOOK

Write ONE sentence that teases a deeper pattern or implication.
Do not resolve it.

## 🧾 OUTPUT FORMAT (STRICT)

Return ONLY the following sections in valid JSON format:

{
  "plant": "The name of the plant",
  "fact": "Brief summary of the fact",
  "script": {
    "hook": "0–4s content",
    "dangle1": "4–9s content",
    "rehook": "9–14s content",
    "dangle2": "14–20s content",
    "payoff": "20–25s content",
    "verifiedTruth": "25–32s content",
    "close": "My brother knows plants. I verify the facts."
  },
  "thumbnailPrompt": "Full thumbnail prompt description",
  "caption": "Two-line caption",
  "part2Hook": "Single teaser sentence"
}`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured')
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate a complete botanical content package. Select a surprising plant fact and create all outputs.' }
        ],
        temperature: 0.9,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AI Gateway error:', errorText)
      throw new Error(`AI Gateway error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content returned from AI')
    }

    // Parse JSON from response
    let parsed
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', content)
      throw new Error('Failed to parse AI response as JSON')
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
