import { GeneratorInput } from "@/components/GeneratorForm";

export interface GeneratedAssets {
  script: string;
  thumbnailPrompt: string;
  caption: string;
  part2Hook: string;
}

export function generateAssets(input: GeneratorInput): GeneratedAssets {
  const { botanicalSubject, claimOrFact, thumbnailStyle } = input;

  const script = generateScript(botanicalSubject, claimOrFact);
  const thumbnailPrompt = generateThumbnailPrompt(botanicalSubject, thumbnailStyle);
  const caption = generateCaption(claimOrFact);
  const part2Hook = generatePart2Hook(botanicalSubject);

  return { script, thumbnailPrompt, caption, part2Hook };
}

function generateScript(subject: string, claim: string): string {
  return `HOOK (0–4s):
My brother told me ${claim.toLowerCase()}.

DANGLE (4–9s):
I didn't believe him.
How would he know that?

RE-HOOK (9–14s):
Turns out I misunderstood what he meant.
He wasn't talking about modern medicine.

DANGLE (14–20s):
The term he used was "digitalis."
That's the compound extracted from ${subject}.

PAYOFF (20–26s):
And he was right.
Doctors used it for heart conditions since the 1700s.
It slowed irregular heartbeats.

CLOSE (26–30s):
My brother knows plants.
I just verify the facts.`;
}

function generateThumbnailPrompt(subject: string, style: "light" | "dark"): string {
  if (style === "light") {
    return `Create a vertical 9:16 cinematic botanical thumbnail.

SUBJECT:
A realistic ${subject} specimen rendered as a physical, museum-grade botanical illustration. Detailed leaves, stems, and flowers depicted with scientific accuracy. The specimen appears pressed and mounted on archival paper.

COMPOSITION:
Subject slightly off-center with clear silhouette and generous negative space. Strong vertical orientation with natural asymmetry.

LIGHTING:
Soft natural daylight with even illumination and gentle shadows. Light falls from upper left. Minimal contrast.

BACKGROUND:
Light architectural surface resembling aged cotton rag paper or limestone. Muted warm-neutral tones (cream, warm white, pale taupe). Subtle texture and fine grain visible.

ANNOTATIONS:
Thin graphite-style architectural annotation lines pointing to key botanical features. Minimal and academic. Small handwritten specimen labels in period script.

MOOD:
Clear, calm, intellectual, trustworthy.

STYLE CONSTRAINTS:
No icons.
No emojis.
No bright colors.
No futuristic or tech elements.
No influencer aesthetics.
No artificial gradients.`;
  }

  return `Create a vertical 9:16 dark cinematic botanical thumbnail.

SUBJECT:
A realistic ${subject} specimen rendered as a physical museum object. Detailed leaves, stems, and flowers depicted with scientific accuracy. The specimen appears three-dimensional, emerging from shadow.

COMPOSITION:
Tighter framing with strong foreground presence. Partial crop allowed at edges. Subject commands the frame.

LIGHTING:
Low-key cinematic lighting. Single directional light source from upper right. Deep shadows with soft transitions. Rim lighting on edges of leaves and petals.

BACKGROUND:
Dark architectural surface (charcoal, deep umber, dark taupe). Subtle grain and texture visible in mid-tones. Vignette toward corners.

ANNOTATIONS:
Minimal architectural annotation lines in pale ochre or aged white. Small academic reference marks and specimen numbers.

MOOD:
Mysterious, investigative, restrained, intellectual.

STYLE CONSTRAINTS:
No icons.
No emojis.
No bright colors.
No futuristic or sci-fi elements.
No artificial glow effects.`;
}

function generateCaption(claim: string): string {
  return `I didn't believe it when I heard this.
But the records go back centuries.`;
}

function generatePart2Hook(subject: string): string {
  return `But ${subject} wasn't the only plant they used this way.`;
}
