// Architectural Botanical Study Plate — locked visual style shared by all six plates.
// Same style across every plate; only the per-moment composition / storytelling purpose changes.
// Subject is dynamic and passed in at call time.

export type Moment =
  | "hook"
  | "dangle_1"
  | "rehook"
  | "dangle_2"
  | "verified_truth"
  | "close";

export const PLATE_STYLE_BLOCK = `ARCHITECTURAL BOTANICAL STUDY PLATE — LOCKED STYLE:
Vertical 9:16 dark mode botanical study plate. Deep charcoal textured paper. Near black parchment background. Fine paper grain. Soft vignette. Cinematic upper left directional lighting. Muted ivory, bone, warm gray, sage, olive, faded green, graphite, and aged natural tones. Realistic botanical or organic specimen illustration. Architectural blueprint layout. Fine graphite construction lines. Measurement brackets. Scientific annotations. Figure labels. Small numeric markers. Subtle museum style serif typography. Premium archival research aesthetic.

AVOID: people, modern elements, neon, cartoon style, bright colors, glossy advertising style, Canva style layouts, white backgrounds, random decorative elements, clutter, and text heavy graphics.`;

export const MOMENT_BRIEFS: Record<Moment, string> = {
  hook:
    "MOMENT — HOOK: Boldest plate. Large hero specimen filling most of the frame. Mysterious, scroll stopping, dramatic upper left light, deep vignette.",
  dangle_1:
    "MOMENT — DANGLE 1: Close up clue. Partial reveal. One isolated detail such as a leaf edge, bud, tendril, root, seed, flower part, fruit surface, or botanical texture cropped tight. Suspenseful. Does not show the whole subject.",
  rehook:
    "MOMENT — RE-HOOK: Second visual punch. Stronger angle, higher contrast, larger scale, more construction lines and brackets framing the specimen.",
  dangle_2:
    "MOMENT — DANGLE 2: Investigative detail. Cross section, anatomy, hidden internal structure, magnified scientific breakdown, measurement brackets, numeric markers.",
  verified_truth:
    "MOMENT — VERIFIED TRUTH: Most credible plate. Organized evidence layout. Labeled A, B, C, D anatomical row. Figure annotations. Clean structured reveal.",
  close:
    "MOMENT — CLOSE: Final archive plate. Calm, resolved, premium, minimal. Single specimen, golden ratio diagram, small archival footer feel.",
};

export function buildPlatePrompt(subject: string, moment: Moment): string {
  const subj = (subject ?? "").trim() || "the selected botanical subject";
  return [
    PLATE_STYLE_BLOCK,
    "",
    MOMENT_BRIEFS[moment],
    "",
    `SUBJECT: ${subj}.`,
    "",
    `Use the exact same Architectural Botanical Study Plate style across all six plates. Only the composition and storytelling purpose change. Subject: ${subj}.`,
  ].join("\n");
}

export function buildAllPlatePrompts(
  subject: string,
): Record<Moment, string> {
  return {
    hook: buildPlatePrompt(subject, "hook"),
    dangle_1: buildPlatePrompt(subject, "dangle_1"),
    rehook: buildPlatePrompt(subject, "rehook"),
    dangle_2: buildPlatePrompt(subject, "dangle_2"),
    verified_truth: buildPlatePrompt(subject, "verified_truth"),
    close: buildPlatePrompt(subject, "close"),
  };
}
