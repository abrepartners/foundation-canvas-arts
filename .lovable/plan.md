## What a "generation" actually costs

Each Generate Content Package call makes:
- **1 text call** to Gemini 2.5 Flash via Lovable AI (writes the script + 6 visual prompts)
- **6 image calls** — one each for Hook, Dangle 1, Re-hook, Dangle 2, Verified Truth, Close — using the image model you picked in the dropdown

The text call is the same across all three options and is effectively free (~0.005 credits / ~$0.001 per package — Gemini Flash text is negligible). The cost differences below are all driven by the **6 images**.

## Per-image rates (provider list price)

Pricing for image gen, as billed when called from your app today. 1 Lovable credit ≈ $0.20.

| Option (dropdown label) | Underlying model | Per-image cost | Billed to |
|---|---|---|---|
| **Lovable (Gemini Nano Banana)** | `google/gemini-2.5-flash-image` via Lovable AI Gateway | ~$0.039 ≈ **0.20 credits** | Lovable workspace credits |
| **OpenAI (gpt-image-2 HQ)** | `openai/gpt-image-2`, quality `high`, 1024×1536 via Lovable AI Gateway | ~$0.19 ≈ **0.95 credits** | Lovable workspace credits |
| **Replicate (FLUX 1.1 Pro)** | `black-forest-labs/flux-1.1-pro` via Replicate connector | **$0.04** | Replicate account (NOT Lovable credits) |

These match what I see in your actual usage breakdown for the current billing period:
- `openai/gpt-image-2 image output`: 3.95 credits used so far
- `google/gemini-2.5-flash-image image output`: 1.07 credits used so far
- Replicate: $0 in Lovable credits — it's billed separately on Replicate's side.

## Per generated package (6 images + 1 text)

| Option | Lovable credits per package | USD per package | Where it hits |
|---|---|---|---|
| **Lovable (Gemini Nano Banana)** | ~**1.2 credits** | ~$0.24 | Lovable workspace |
| **OpenAI (gpt-image-2 HQ)** | ~**5.7 credits** | ~$1.14 | Lovable workspace |
| **Replicate (FLUX 1.1 Pro)** | ~0 credits (just the text call) | ~**$0.24** | Replicate account |

## Per 100 generations (rough planning numbers)

| Option | Lovable credits | USD |
|---|---|---|
| Lovable (Gemini) | ~120 credits | ~$24 |
| OpenAI (gpt-image-2 HQ) | ~570 credits | ~$114 |
| Replicate (FLUX 1.1 Pro) | ~0 credits | ~$24 (on Replicate) |

## What this means for the credit-cap problem you just hit

The reason you hit "Workspace credit limit reached" today is almost certainly the **OpenAI HQ** path — each package burns ~6 credits, vs ~1.2 on the Lovable Gemini option and ~0 on Replicate.

Two practical takeaways:
1. **Replicate FLUX 1.1 Pro is the cheapest *and* doesn't touch your Lovable monthly cap.** Same ~$0.24/package as Gemini Nano Banana, but it goes against your Replicate balance instead of Lovable credits — so it won't lock you out of build/plan mode messages when the workspace cap is reached.
2. **Lovable Gemini Nano Banana is essentially free** at ~1 credit per package, but it does count against the workspace cap.
3. **OpenAI HQ is ~5× more expensive** than the other two. Use it only when you specifically want that look.

## Deliverable

This is a research/projection answer — no code change unless you want it. If helpful next steps:
- Add a small "~X credits / ~$Y per package" hint under the image-model dropdown so the cost is visible at the moment of choice.
- Default the dropdown to **Replicate (FLUX 1.1 Pro)** so casual generations don't eat the workspace cap.

Tell me which (or both) and I'll build it.
