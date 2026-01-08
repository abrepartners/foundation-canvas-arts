interface GeneratorInput {
  subject: string;
  claim: string;
  thumbnailMode: "light" | "dark";
}

interface GeneratedAssets {
  script: string;
  thumbnailPrompt: string;
  caption: string;
  partTwoHook: string;
}

export const generateAssets = (input: GeneratorInput): GeneratedAssets => {
  const { subject, claim, thumbnailMode } = input;

  const script = `HOOK (0–4s):
${claim}

DANGLE (4–9s):
I had to look this one up myself.

RE-HOOK (9–14s):
But here's what most people get wrong about ${subject}.

DANGLE (14–20s):
The compound isn't the whole story.

PAYOFF (20–26s):
My brother verified the research. The claim checks out—but the context matters.

CLOSE (26–30s):
I just verify what he finds.`;

  const thumbnailPrompt = thumbnailMode === "light" 
    ? `Create a vertical 9:16 cinematic botanical thumbnail.

SUBJECT:
A realistic ${subject} specimen rendered as a physical, museum-grade pressed botanical object. Dried leaves and bark fragments arranged with scientific precision. Visible cellular texture and natural imperfections.

COMPOSITION:
Subject slightly off-center with clear silhouette and generous negative space on the left third.

LIGHTING:
Soft natural daylight streaming from upper left. Even illumination with gentle cast shadows. No harsh highlights.

BACKGROUND:
Light architectural surface resembling aged cotton rag paper with subtle foxing. Muted warm-neutral cream and ivory tones. Visible paper grain and fiber texture.

ANNOTATIONS:
Thin graphite-style architectural annotation lines extending from key botanical features. Minimal sans-serif Latin nomenclature in faded ink. Small measurement scale in lower corner.

MOOD:
Clear, calm, intellectual, trustworthy. Museum archive aesthetic.

STYLE CONSTRAINTS:
No icons. No emojis. No bright colors. No futuristic or tech elements. No influencer aesthetics. No digital overlays. Photorealistic rendering only.`
    : `Create a vertical 9:16 dark cinematic botanical thumbnail.

SUBJECT:
A realistic ${subject} specimen rendered as a physical museum object. Dried botanical material with visible texture and age. Arranged as a scientific reference specimen.

COMPOSITION:
Tighter framing with strong foreground presence. Partial crop of outer leaves permitted. Subject fills 60% of frame.

LIGHTING:
Low-key cinematic lighting from single directional source at upper right. Deep shadows with soft gradient transitions. Rim light on specimen edges.

BACKGROUND:
Dark architectural surface in deep charcoal with warm umber undertones. Subtle linen grain texture. Vignette toward edges.

ANNOTATIONS:
Minimal chalk-white architectural annotation lines. Small academic reference marks and specimen numbers. Restrained typographic elements.

MOOD:
Mysterious, investigative, restrained, intellectual. Rare archive discovery aesthetic.

STYLE CONSTRAINTS:
No icons. No emojis. No bright colors. No futuristic or sci-fi elements. No neon. No digital glows. Photorealistic rendering only.`;

  const caption = `I didn't believe this one at first.
Turns out ${subject.toLowerCase()} has more history than most realize.`;

  const partTwoHook = `But what they never mention is what happened when researchers tried to isolate the compound—and why that changed everything.`;

  return {
    script,
    thumbnailPrompt,
    caption,
    partTwoHook,
  };
};
