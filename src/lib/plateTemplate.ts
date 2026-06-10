// Canonical "Architectural Botanical Study Plate" template.
// This is the LOCKED layout/style system. Only the botanical subject changes per plant.
// Keep this string in sync with the edge function copy in
// supabase/functions/generate-botanical-content/index.ts and
// supabase/functions/regenerate-visual/index.ts.

export const PLATE_TEMPLATE = `Vertical 9:16 dark-mode botanical archive plate on deep charcoal to near-black textured paper with fine grain, subtle parchment texture, soft vignette, and low-key directional light from the upper left.

The plate MUST include ALL of the following layout elements (strict template — every element must appear):

TOP LEFT:
- Plant common name in large refined serif (warm bone/ivory)
- Latin binomial directly below in smaller italic serif
- A 3-4 line short description (evergreen/deciduous, family, native region, notable use) in small muted serif

TOP RIGHT:
- "PLATE — 0X" label in small spaced sans-serif caps

CENTER:
- ONE hero botanical specimen (real photographic specimen aesthetic, slightly desaturated, museum-grade) — a single branch with leaves, fruit, or seed structure
- Thin graphite construction lines, circular golden-ratio overlays, and faint geometric framing behind the specimen
- Numeric annotations along the right edge (e.g. "2.8", "1.618", "0.618", "2.1", "4.7") in small serif
- "Fig. 1  Branch" label in small italic serif beneath the specimen

LOWER SECTION:
- "Morphology" header in small serif
- A short labeled list (A. Flower / B. Fruit / C. Seed — or Cone/Bud/Leaf as appropriate)
- A horizontal row of 3-4 small hand-drawn anatomical illustrations labeled A, B, C, D
- A small circular golden-ratio diagram on the right with "Scale  1:2" label

FOOTER:
- "BOTANICAL STUDY ARCHIVE" in small spaced sans-serif caps on the left
- "MMXXIV" on the right
- Thin border frame around the entire plate

Composition: architectural blueprint meets archival botanical study plate. Hand-drawn botanical sketches, abstract leaves, stems, seed structures, thin graphite construction lines, measurement marks, numeric annotations, subtle diagram labels. Clean, premium, calm, contemplative.

Palette: muted warm-gray, bone, ivory, parchment, sage, olive, graphite. No bright colors, no neon, no cartoon styling, no oversaturated greens.

Mood: cinematic, intellectual, architectural, archival, calm authority, meditative, editorial.

Aspect ratio: 9:16 vertical.
Lighting: low-key, soft upper-left directional light.
Texture: dark paper, fine grain, parchment, subtle vignette.

STYLE CONSTRAINTS (STRICT):
- No people, no faces, no hands, no silhouettes
- No modern elements (phones, screens, logos, brands)
- No bright/neon colors, no cartoon, no 3D render look

CONSISTENCY LINE (REQUIRED):
Use the exact same Architectural Botanical Study Plate style. Only change the botanical subject. Do not change the scene, composition language, lighting, texture, typography style, or overall visual system.`;

export interface PlateSubject {
  commonName: string;
  binomial: string;
  description: string;
  specimenNote?: string;
}

export function composePlatePrompt(
  subject: PlateSubject,
  momentNote?: string
): string {
  const parts = [
    PLATE_TEMPLATE,
    "",
    "BOTANICAL SUBJECT (changes per plate):",
    `- Common name: ${subject.commonName}`,
    `- Latin binomial: ${subject.binomial}`,
    `- Short description: ${subject.description}`,
  ];
  if (subject.specimenNote && subject.specimenNote.trim()) {
    parts.push(`- Hero specimen: ${subject.specimenNote.trim()}`);
  }
  if (momentNote && momentNote.trim()) {
    parts.push("", `MOMENT NOTE: ${momentNote.trim()}`);
  }
  return parts.join("\n");
}

// Best-effort extraction of subject fields from an existing prompt string,
// so the dialog can pre-fill values. Falls back to empty strings.
export function parseSubjectFromPrompt(prompt: string): PlateSubject {
  const grab = (re: RegExp) => {
    const m = prompt.match(re);
    return m?.[1]?.trim() ?? "";
  };
  return {
    commonName: grab(/Common name:\s*(.+)/i),
    binomial: grab(/Latin binomial:\s*(.+)/i),
    description: grab(/Short description:\s*([\s\S]+?)(?:\n\s*-\s|\n\n|$)/i),
    specimenNote: grab(/Hero specimen:\s*([\s\S]+?)(?:\n\s*-\s|\n\n|$)/i),
  };
}
