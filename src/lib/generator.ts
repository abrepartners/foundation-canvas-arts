import type { GeneratorInputs, GeneratedContent } from "@/types/generator";

export function generateContent(inputs: GeneratorInputs): GeneratedContent {
  const { botanicalSubject, claimToVerify, thumbnailMode } = inputs;

  const script = generateScript(botanicalSubject, claimToVerify);
  const thumbnailPrompt = thumbnailMode === "Light" 
    ? generateLightThumbnail(botanicalSubject)
    : generateDarkThumbnail(botanicalSubject);
  const caption = generateCaption(botanicalSubject, claimToVerify);
  const part2Hook = generatePart2Hook(botanicalSubject);

  return {
    script,
    thumbnailPrompt,
    caption,
    part2Hook,
    thumbnailMode,
  };
}

function generateScript(subject: string, claim: string): string {
  return `HOOK (0–4s):
Someone told me ${subject.toLowerCase()} does something unexpected.
And I didn't believe it at first.

DANGLE (4–9s):
Because that sounds like folklore.
The kind of thing that gets passed around without anyone checking.

RE-HOOK (9–14s):
But then I looked at what people actually mean when they say this.
And there's a gap between the claim and the reality.

DANGLE (14–20s):
See, ${subject.toLowerCase()} isn't magic.
It's a plant with specific compounds doing specific things.

PAYOFF (20–25s):
The claim sounds too simple.
That's usually where the misunderstanding starts.

VERIFIED TRUTH (25–32s):
${subject} contains documented active compounds.
The effect is real, but the mechanism is more specific than most people assume.

CLOSE (32–35s):
My brother knows plants.
I verify the facts.`;
}

function generateLightThumbnail(subject: string): string {
  return `Create a vertical 9:16 cinematic botanical thumbnail.

SUBJECT:
A realistic ${subject.toLowerCase()} specimen rendered as a physical, museum-grade pressed botanical object. Delicate stems, leaves, and any flowers or seed heads visible. Preserved with archival precision.

COMPOSITION:
Subject placed slightly off-center with clear silhouette against negative space. Balanced asymmetry. Room for text overlay in upper third.

LIGHTING:
Soft natural daylight streaming from upper left. Even illumination across the specimen. Gentle diffused shadows beneath leaves and stems.

BACKGROUND:
Light architectural surface resembling aged handmade paper or weathered limestone plaster. Muted warm-neutral cream and ivory tones. Subtle organic texture and fine grain visible.

ANNOTATIONS:
Thin graphite-style architectural annotation lines extending from key botanical features. Minimal sans-serif reference marks. Small measurement indicators. Academic and restrained.

MOOD:
Clear, calm, intellectual, trustworthy. Museum quality. Scientific observation.

STYLE CONSTRAINTS:
No icons. No emojis. No bright saturated colors. No digital or futuristic elements. No influencer aesthetics. No text overlays in the image itself.`;
}

function generateDarkThumbnail(subject: string): string {
  return `Create a vertical 9:16 dark cinematic botanical thumbnail.

SUBJECT:
A realistic ${subject.toLowerCase()} specimen rendered as a physical museum-grade pressed botanical object. Dried stems, leaves, and botanical details visible. Aged and preserved with archival care.

COMPOSITION:
Tighter framing with strong foreground presence. Partial crop of the specimen allowed at edges. Subject fills more of the frame. Dramatic and intimate.

LIGHTING:
Low-key cinematic lighting with single directional light source from upper right. Deep shadows with soft gradient transitions. Rim lighting on edges of leaves and stems.

BACKGROUND:
Dark architectural surface in charcoal, deep umber, or muted taupe. Subtle canvas or plaster texture. Fine grain visible in shadows.

ANNOTATIONS:
Minimal architectural annotation lines in muted chalk or aged graphite tones. Small academic reference marks. Sparse and intentional.

MOOD:
Mysterious, investigative, restrained, intellectual. Cabinet of curiosities. Scientific inquiry in shadow.

STYLE CONSTRAINTS:
No icons. No emojis. No bright saturated colors. No futuristic or sci-fi elements. No digital aesthetics. No text overlays in the image itself.`;
}

function generateCaption(subject: string, claim: string): string {
  return `Didn't expect ${subject.toLowerCase()} to check out.
But the compounds don't lie.`;
}

function generatePart2Hook(subject: string): string {
  return `But there's something about ${subject.toLowerCase()} that most sources leave out entirely.`;
}
