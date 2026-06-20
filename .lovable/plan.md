## Problem

The toast says "AI credits exhausted" with "daily free credits reset every 24h", but the workspace has plenty of credits (87.98 remaining, 5/5 daily available). The real upstream error from AI Gateway is:

```
type: "credit_limit_reached"
message: "Workspace credit limit reached"
details: "This workspace has reached its credit limit. Ask your workspace owner to adjust the workspace limit."
scope: "workspace"
```

This is a **workspace member monthly credit cap** (set in Settings → Workspace → "Default monthly member credit limit" or Settings → People → "Set credit limit"), not the daily free-credit pool. Our current message points users to the wrong place.

## Fix

Update the error message in all three edge functions and the client formatter so it reflects what AI Gateway is actually saying.

### Edge functions (`generate-botanical-content`, `generate-trend-content`, `regenerate-visual`)

Change the `CREDIT_LIMIT:` thrown message from the daily-reset text to:

> "CREDIT_LIMIT: Workspace credit limit reached. The workspace owner needs to raise the monthly member credit limit in Settings → Workspace (or Settings → People for a specific member), or add top-up credits in Settings → Plans & credits."

### Client (`src/hooks/useBotanicalContent.ts` → `formatGatewayError`)

Update the `CREDIT_LIMIT` branch:
- Title: `"Workspace credit limit reached"`
- Message: same as above — point at the member-limit setting first, top-up second, drop the "daily resets in 24h" line (it's not the cause).

### Real resolution (outside code)

The user (workspace owner) needs to go to **Settings → Workspace** and raise the **Default monthly member credit limit**, or set a higher per-member limit in **Settings → People**. The code change just stops sending them on a wild goose chase.

## Files

- `supabase/functions/generate-botanical-content/index.ts` (line ~470)
- `supabase/functions/generate-trend-content/index.ts` (line ~449)
- `supabase/functions/regenerate-visual/index.ts` (lines ~355, ~389)
- `src/hooks/useBotanicalContent.ts` (`formatGatewayError`, lines ~9-23)

Then redeploy the three edge functions.
