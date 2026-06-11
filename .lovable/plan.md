
## Goal

Add a one-click button on the generation result screen that sends the 6 generated 9:16 botanical plate images to the user's TikTok as a **photo carousel draft** (inbox draft — nothing is published publicly until the user opens TikTok and taps Post).

## How it works

1. **UI** — In `ContentDisplay.tsx`, next to "Regenerate all with new style", add a "Send to TikTok (draft)" button. Disabled until all 6 images have `image_url`. Shows loading + success/error toast.

2. **New edge function** `post-tiktok-carousel` (`verify_jwt = false`, CORS enabled):
   - Input: array of 6 public image URLs + caption + title (plant name).
   - Calls TikTok via the Lovable connector gateway:
     `POST https://connector-gateway.lovable.dev/tiktok/post/publish/content/init/`
   - Body uses TikTok's photo-mode payload:
     ```json
     {
       "post_info": {
         "title": "<plant name>",
         "description": "<caption>",
         "disable_comment": false,
         "auto_add_music": true
       },
       "source_info": {
         "source": "PULL_FROM_URL",
         "photo_cover_index": 0,
         "photo_images": ["<url1>", ..., "<url6>"]
       },
       "post_mode": "MEDIA_UPLOAD",
       "media_type": "PHOTO"
     }
     ```
   - `MEDIA_UPLOAD` = lands in the user's TikTok inbox as a draft (not auto-published).
   - Returns TikTok's `publish_id` to the client.

3. **Headers** sent to the gateway:
   - `Authorization: Bearer ${LOVABLE_API_KEY}`
   - `X-Connection-Api-Key: ${TIKTOK_API_KEY}`
   (Both are already auto-injected since the TikTok connector is linked.)

4. **Image hosting requirement** — TikTok pulls images from the URLs we send, so the URLs must be publicly reachable. The images are already stored in the Supabase storage bucket with public URLs, so this works as-is. No re-upload needed.

5. **No publishing, no scopes beyond what the connector already grants.** The user finishes the post manually inside the TikTok app.

## Files touched

- `supabase/functions/post-tiktok-carousel/index.ts` — new
- `supabase/config.toml` — add `[functions.post-tiktok-carousel] verify_jwt = false`
- `src/components/ContentDisplay.tsx` — add button + handler + toast
- (optional) `src/hooks/useBotanicalContent.ts` — thin wrapper `sendToTikTok(content)` if you'd rather keep the call out of the component

## Not in scope

- Auto-publishing (would require `video.publish` scope + review).
- Video assembly.
- Posting history tracking in the DB.

Confirm and I'll switch to build.
