Plan: Better credit-error surfacing for AI Gateway failures

Problem
-------
The generate-trend-content (and generate-botanical-content / regenerate-visual) edge functions return a generic 500 when the Lovable AI Gateway responds with a 402/403 credit-limit error. The UI shows "AI Gateway request failed: 403" which looks like a bug rather than a billing issue.

What to build
-------------
1. **Edge-function error classification**
   In all three edge functions, when an AI Gateway call fails with status 402 or 403, read the response body and check for `credit_limit_reached` or `credit_limit` in the error JSON. If matched, throw a dedicated `CreditLimitError` with a clear message.

2. **Catch-block mapping**
   In the top-level `catch` of each edge function, detect `CreditLimitError` and return:
   - HTTP status 402 (Payment Required)
   - JSON body: `{ success: false, error: "AI credits exhausted", error_code: "CREDIT_LIMIT", details: "Daily credit limit reached. Total remaining: N credits. Wait for daily reset or add top-up credits." }`

3. **UI toast + state handling**
   In `useBotanicalContent.ts` and `useTrendContent.ts`, when `fnError` or the response contains `error_code === "CREDIT_LIMIT"`, set `error` state to the human-readable message and show a `destructive` toast that explicitly says credits are exhausted and hints at waiting for the daily reset.

4. **Optional: credit-aware generate button**
   In `GenerateButton.tsx`, add a small tooltip or inline text when the `openai` provider is selected, noting its higher credit cost. (The OpenAI/gpt-image-2 path is the most expensive provider — a single 6-image generation can burn 6 credits or more, easily exhausting a 5-credit daily cap in one click.)

Files to touch
--------------
- supabase/functions/generate-trend-content/index.ts
- supabase/functions/generate-botanical-content/index.ts
- supabase/functions/regenerate-visual/index.ts
- src/hooks/useBotanicalContent.ts
- src/hooks/useTrendContent.ts
- src/components/GenerateButton.tsx

Out of scope
------------
- Adding a live credit-balance API call on every page load.
- Changing AI models or providers.
- Adjusting workspace billing settings (only the workspace owner can do that).