## Problem

Replicate is rejecting every image request with:

> `output_format must be one of the following: "png", "jpeg", "webp"`

We were sending `output_format: "jpg"`, which Replicate doesn't accept (their valid values are `png`, `jpeg`, `webp`). This affects both the OpenAI (`openai/gpt-image-2`) path and the FLUX path.

## Fix

1. In all three edge functions, change the Replicate input from `output_format: "jpg"` to `output_format: "jpeg"`:
   - `supabase/functions/generate-botanical-content/index.ts`
   - `supabase/functions/generate-trend-content/index.ts`
   - `supabase/functions/regenerate-visual/index.ts`

2. Keep the saved file extension as `.jpg` with `image/jpeg` content type — that's just a filename, browsers and TikTok don't care.

3. Deploy the three functions and run one OpenAI generation through the edge function to confirm Replicate accepts the payload and an image lands in storage.

No UI, pricing, or provider-selection changes — this is a one-character payload fix (`jpg` → `jpeg`) in three files.