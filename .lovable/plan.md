## Goal

Add a manual **Post to TikTok** action on a generated content item. It sends the 6 faceless-visual plates as a **photo carousel** to your TikTok inbox as a **draft**, with the generated caption attached. You finish/publish from the TikTok app.

## How it works

1. You click **Post to TikTok** on a content item.
2. A dialog shows the 6 plates, lets you edit the caption (prefilled from `content.caption`), and confirms.
3. An edge function calls TikTok's Content Posting API via the Lovable connector gateway:
   - `POST /post/publish/content/init/` with `post_mode: MEDIA_UPLOAD` (inbox draft), `media_type: PHOTO`, and the 6 public image URLs from the `botanical-faceless-visuals` bucket.
4. The dialog shows success + a hint to open TikTok mobile to finalize.

## Steps

1. **Connect TikTok connector** — trigger the connection picker so `TIKTOK_API_KEY` is injected as an env var. (You'll authorize your TikTok account in a popup.)
2. **New edge function `post-to-tiktok`** in `supabase/functions/post-to-tiktok/index.ts`:
   - Input (zod): `{ content_id: string, caption: string }`
   - Loads the row from `botanical_content`, parses `script_visuals` to get the 6 `image_url`s.
   - Validates all URLs are public `https://` from the project's storage bucket (TikTok requires verified domains; we'll surface a clear error if TikTok rejects them so we can add domain verification next).
   - Calls `https://connector-gateway.lovable.dev/tiktok/post/publish/content/init/` with `Authorization: Bearer $LOVABLE_API_KEY` and `X-Connection-Api-Key: $TIKTOK_API_KEY`.
   - Returns `{ success, publish_id }` or a structured error.
3. **Frontend**
   - `src/components/PostToTikTokDialog.tsx` — shadcn Dialog: caption textarea (prefilled), thumbnail strip of the 6 plates, Post button, success/error state.
   - `src/components/ContentDisplay.tsx` — add a **Post to TikTok** button next to the existing actions; opens the dialog.
   - `src/hooks/useBotanicalContent.ts` — add `postToTikTok(caption)` that invokes the edge function.

## Technical notes

- Gateway URL: `https://connector-gateway.lovable.dev/tiktok/post/publish/content/init/` (gateway injects `/v2` and the OAuth token).
- Photo carousel max = 35 images; we send 6. Each image must be a publicly reachable HTTPS URL — the existing `botanical-faceless-visuals` bucket is already public.
- `post_mode: MEDIA_UPLOAD` = inbox draft (no Direct Post approval needed). Caption is sent in the init payload.
- If TikTok returns `url_ownership_unverified`, we'll need to verify the storage domain in the TikTok developer portal — handled as a follow-up only if it comes up.
- No DB schema changes. No new secrets beyond what the connector injects.

## Out of scope

- Auto-posting on generate, analytics/stats, video uploads, scheduling, multi-account support.
