## Switch OpenAI image generation from Lovable AI Gateway to Replicate

### Problem
The `openai` image provider currently routes `gpt-image-2` through the Lovable AI Gateway, consuming ~0.95 Lovable credits per image and hitting the workspace credit cap. Replicate also hosts `openai/gpt-image-2` and the project already has the Replicate connector (`REPLICATE_API_KEY`) configured.

### Solution
Route the `openai` provider through the Replicate connector instead. This bills to the user's Replicate account and frees Lovable workspace credits for build/plan usage.

### Changes

**1. Edge functions — image generation routing**
Update the `provider === "openai"` branch in:
- `supabase/functions/generate-botanical-content/index.ts`
- `supabase/functions/generate-trend-content/index.ts`
- `supabase/functions/regenerate-visual/index.ts`

Replace the direct Lovable AI Gateway (`ai.gateway.lovable.dev/v1/images/generations`) call with the Replicate connector pattern (`connector-gateway.lovable.dev/replicate/v1/models/openai/gpt-image-2/predictions`), including create → poll → fetch output. Reuse the same retry/backoff logic already present for FLUX 1.1 Pro.

Input parameters for Replicate's `openai/gpt-image-2`:
- `prompt`
- `quality: "high"`
- `aspect_ratio: "9:16"`
- `output_format: "jpg"`

**2. UI cost hints**
Update `src/components/GenerateButton.tsx`:
- Change the "openai" option label/hint to indicate it now bills to Replicate (not Lovable credits).
- Keep the existing ~5× cost comparison relative to FLUX since gpt-image-2 is still significantly more expensive per image than FLUX 1.1 Pro.

**3. No client-side changes needed**
The `ImageProvider` type (`"lovable" | "replicate" | "openai"`) stays the same; only the backend routing changes.

### Acceptance criteria
- Selecting "OpenAI (gpt-image-2)" generates images via Replicate.
- The generation succeeds end-to-end (create → poll → storage → public URL).
- Lovable workspace credits are not consumed for `openai` provider image calls.
- Cost hint in the UI accurately reflects Replicate billing.