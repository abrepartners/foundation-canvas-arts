// Extract the bold headline (Section 0) from a long-form caption.
// The AI spec wraps the headline in **double asterisks** on the first line.
export function extractCaptionTitle(caption: string | undefined | null): string | null {
  if (!caption) return null;
  const match = caption.match(/\*\*(.+?)\*\*/);
  if (!match) return null;
  const title = match[1].replace(/\s+/g, " ").trim();
  return title.length > 0 ? title : null;
}

// Display/TikTok title: prefer the caption headline, fall back to plant_name.
// TikTok caps post titles at 90 chars.
export function getDisplayTitle(
  content: { caption?: string; plant_name?: string } | null | undefined,
  maxLength = 90,
): string {
  const fromCaption = extractCaptionTitle(content?.caption);
  const fallback = content?.plant_name ?? "";
  const chosen = fromCaption ?? fallback;
  return chosen.length > maxLength ? chosen.slice(0, maxLength).trim() : chosen;
}

// Remove the bold **Title** line from a caption so it isn't duplicated
// when the title is surfaced separately (e.g. TikTok post title field).
export function stripCaptionTitle(caption: string | undefined | null): string {
  if (!caption) return "";
  return caption.replace(/\*\*(.+?)\*\*\s*\n*/, "").replace(/^\s+/, "");
}
