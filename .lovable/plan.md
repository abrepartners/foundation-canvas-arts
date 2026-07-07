Strip the bold `**Title**` line from the caption description sent to TikTok — only in the TikTok send path, nothing else changes.

**Changes:**

1. `src/lib/captionTitle.ts` — add `stripCaptionTitle(caption)`: removes the first `**…**` occurrence and any leading whitespace/newlines it leaves behind. Returns the remaining caption body untouched.

2. `src/components/ContentDisplay.tsx` — in `handleSendTikTok`, pass `description: stripCaptionTitle(content.caption)` instead of `content.caption`. Title stays as `getDisplayTitle(content)`.

**Out of scope:** the caption stored in the DB, on-screen caption rendering, other send paths, generation prompts.