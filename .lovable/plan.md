## Pricing clarification

One AI call is NOT $1. Lovable AI Gateway bills per-token / per-image. Rough costs:
- Text generation (Gemini Flash): fractions of a cent per call
- Image generation (Nano Banana): ~1–3 cents per image

Your current 7-call package (1 text + 6 images) costs roughly $0.05–$0.20, not $7. A $1 top-up covers many full packages.

Replicate is billed separately by Replicate itself (FLUX 1.1 Pro ≈ $0.04/image), through the connector.

## Replicate plan

Your "My Replicate" connection exists but isn't linked to this project. I'll link it, then add it as an **optional** image provider alongside the existing Lovable AI (Nano Banana) path.

### Steps

1. **Link the Replicate connector** to this project so `LOVABLE_CONNECTOR_REPLICATE_API_KEY` is available to edge functions.

2. **Add a provider toggle** in the generate flow:
   - Default: Lovable AI (Nano Banana) — unchanged
   - Option: Replicate (FLUX 1.1 Pro)
   - UI: a small select/toggle on the generate panel near the Generate button.

3. **Update `generate-botanical-content` edge function**:
   - Accept `image_provider: "lovable" | "replicate"` in the request body
   - When `replicate`: call FLUX 1.1 Pro via the connector gateway (`https://connector-gateway.lovable.dev/replicate/v1/models/black-forest-labs/flux-1.1-pro/predictions`) per plate, poll until succeeded, then upload the resulting image to the `botanical-faceless-visuals` bucket (same as today)
   - When `lovable`: keep existing Nano Banana path
   - Same 6-plate parallel generation, same DB update pattern

4. **Update `regenerate-visual` edge function** the same way so single-plate regenerations honor the chosen provider.

5. **Pass the chosen provider through** `useBotanicalContent` hook → edge function call.

### Notes

- Warm Botanical Plate prompt stays identical; only the model swaps.
- FLUX 1.1 Pro takes ~5–15s per image; 6 in parallel should finish in ~15–25s.
- No new secrets needed — the connector injects them automatically.
