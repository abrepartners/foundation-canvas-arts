import type { GeneratorInput, GeneratorOutput } from '@/types/generator';

export function generateContent(input: GeneratorInput): GeneratorOutput {
  const { botanicalSubject, claimToVerify, thumbnailMode } = input;

  // Generate script following exact template structure
  const script = generateScript(botanicalSubject, claimToVerify);
  
  // Generate thumbnail prompt based on mode
  const thumbnailPrompt = thumbnailMode === 'light' 
    ? generateLightThumbnail(botanicalSubject)
    : generateDarkThumbnail(botanicalSubject);

  // Generate caption
  const caption = generateCaption(botanicalSubject, claimToVerify);

  // Generate Part 2 hook
  const part2Hook = generatePart2Hook(botanicalSubject);

  return { script, thumbnailPrompt, caption, part2Hook };
}

function generateScript(subject: string, claim: string): string {
  return `HOOK (0–4s):
So I heard something interesting about ${subject} the other day.

DANGLE (4–9s):
At first, I wasn't sure what to think.

RE-HOOK (9–14s):
Turns out, the story is more complicated than it sounds.

DANGLE (14–20s):
The real question is what we mean when we talk about this.

PAYOFF (20–25s):
Here's why the original idea seems off.

VERIFIED TRUTH (25–32s):
[Research the verified botanical fact about ${subject} related to: "${claim}"]

CLOSE (32–35s):
My brother knows plants. I verify the facts.`;
}

function generateLightThumbnail(subject: string): string {
  return `Create a vertical 9:16 cinematic botanical thumbnail.

SUBJECT:
A realistic ${subject} specimen rendered as a physical, museum-grade pressed botanical object. Detailed leaf structure, natural coloration, and visible texture.

COMPOSITION:
Subject slightly off-center with clear silhouette and generous negative space. Academic specimen arrangement.

LIGHTING:
Soft natural daylight with even illumination and gentle shadows. No harsh highlights.

BACKGROUND:
Light architectural surface resembling aged paper, plaster, or limestone. Muted warm-neutral tones (ivory, cream, pale taupe). Subtle texture and fine grain visible.

ANNOTATIONS:
Thin graphite-style architectural annotation lines pointing to key botanical features. Minimal and academic. Small handwritten-style labels.

MOOD:
Clear, calm, intellectual, trustworthy.

STYLE CONSTRAINTS:
No icons. No emojis. No bright colors. No futuristic or tech elements. No influencer aesthetics. No digital overlays.`;
}

function generateDarkThumbnail(subject: string): string {
  return `Create a vertical 9:16 dark cinematic botanical thumbnail.

SUBJECT:
A realistic ${subject} specimen rendered as a physical museum object. Detailed texture, natural form, dimensional presence.

COMPOSITION:
Tighter framing. Strong foreground presence. Partial crop allowed. Subject emerging from shadow.

LIGHTING:
Low-key cinematic lighting. Single directional light source from upper left. Deep shadows with soft transitions. Rim light on edges.

BACKGROUND:
Dark architectural surface (charcoal, umber, deep taupe). Subtle grain and texture. Vignette toward edges.

ANNOTATIONS:
Minimal architectural annotation lines in muted cream or sepia. Small academic reference marks.

MOOD:
Mysterious, investigative, restrained, intellectual.

STYLE CONSTRAINTS:
No icons. No emojis. No bright colors. No futuristic or sci-fi elements. No digital effects.`;
}

function generateCaption(subject: string, claim: string): string {
  return `I didn't expect ${subject} to be this complicated.
The truth is quieter than the claim.`;
}

function generatePart2Hook(subject: string): string {
  return `But what nobody mentions is what happens when you look at ${subject} under different conditions.`;
}
