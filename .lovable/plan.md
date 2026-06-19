# Add OpenAI gpt-image-2 as a third image model

## Goal
Add OpenAI's `gpt-image-2` (high quality, 1024×1536 portrait) as a selectable image provider, alongside the existing Lovable Nano Banana (Gemini) and Replicate Flux 1.1 Pro options. No existing behavior changes — purely additive.

## Why this is a small change
The codebase already has clean provider-switching seams:
- `GenerateButton.tsx` has a `Select` for image model
- Both `generate-*-content` edge functions and `regenerate-visual` already branch on an `image_provider` string
- `LOVABLE_API_KEY` already covers the new endpoint — no new secret needed

## Changes

### 1. Frontend selector (`src/components/GenerateButton.tsx`)
- Extend `ImageProvider` type to `"lovable" | "replicate" | "openai"`
- Add a third `<SelectItem value="openai">OpenAI (gpt-image-2 HQ)</SelectItem>`

### 2. Pipe provider through hooks/pages
- `useBotanicalContent.ts` / `useTrendContent.ts` / `Index.tsx` / `Trends.tsx` / `ContentDisplay.tsx` already forward `image_provider`. Just widen the union type — no logic change.

### 3. Edge function: `regenerate-visual/index.ts`
Add a third branch after the existing Replicate / Lovable branches:

```ts
} else if (imageProvider === "openai") {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-image-2",
      prompt: finalPrompt,
      quality: "high",       // user picked HQ tier
      size: "1024x1536",     // closest portrait, ~2:3
      n: 1,
      // non-streaming — edge function only needs the final PNG to upload
    }),
  });
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  imageBuffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
```

- Save as `.png` (OpenAI returns PNG). TikTok publish pipeline already transcodes PNGs where needed.
- Note: output is 2:3, not 9:16 — slight letterbox vs the existing Flux/Gemini 9:16 outputs. Per your answer, we keep 1024×1536 as-is (no auto-crop).

### 4. Edge functions: `generate-botanical-content/index.ts` and `generate-trend-content/index.ts`
Apply the same third branch in the per-moment image loop where the current `imageProvider` switch lives. Same body, same upload path (`botanical-faceless-visuals` bucket, versioned path).

### 5. Cost/quality note surfaced in UI
Add a small helper line under the select: *"HQ tier — slower and more expensive than the other two."* So you don't accidentally burn credits on a 6-tile carousel.

## Out of scope (explicitly NOT changing)
- Lovable Nano Banana path
- Replicate Flux 1.1 Pro path
- Prompt content (`architecturalPlate.ts` stays as-is)
- 9:16 ratio for the other providers
- Storage paths, history, regenerate flow, captions, TikTok publish

## Files touched
- `src/components/GenerateButton.tsx`
- `src/hooks/useBotanicalContent.ts`
- `src/hooks/useTrendContent.ts`
- `src/pages/Index.tsx`
- `src/pages/Trends.tsx`
- `src/components/ContentDisplay.tsx` (type widening only)
- `supabase/functions/generate-botanical-content/index.ts`
- `supabase/functions/generate-trend-content/index.ts`
- `supabase/functions/regenerate-visual/index.ts`

## Verification after build
1. Switch model to "OpenAI" → generate one content package → confirm 6 tiles render
2. Switch back to Replicate → confirm Flux path still works
3. Per-tile regenerate with OpenAI selected → confirm history is preserved
