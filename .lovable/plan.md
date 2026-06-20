## Goal

Make the GPT image option (`openai/gpt-image-2` via Replicate) produce true 9:16 vertical plates, matching the FLUX path and TikTok's vertical format.

## Changes

Change `aspect_ratio: "2:3"` → `aspect_ratio: "9:16"` in the openai branch of three edge functions:

1. `supabase/functions/generate-botanical-content/index.ts` (line 142)
2. `supabase/functions/generate-trend-content/index.ts` (line 139)
3. `supabase/functions/regenerate-visual/index.ts` (line 277)

Then redeploy all three.

## Not changing

- Concurrency stays at **2** for the openai provider (your call — safer, avoids 429s).
- `quality: "high"`, `output_format: "jpeg"` stay as-is.
- No changes to FLUX path, Gemini path, prompts, UI, or pricing.

## Verify

After deploy, run one GPT generation and confirm in storage the returned images are vertical 9:16.
