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
    "MOMENT — HOOK (SHOT TYPE: FULL HERO SPECIMEN): One large complete botanical subject filling most of the vertical frame. Dramatic, mysterious, scroll stopping. This plate CAN show the full subject. Heavy upper left directional light, deep vignette.",
  dangle_1:
    "MOMENT — DANGLE 1 (SHOT TYPE: EXTREME MACRO CLUE ONLY): Do NOT show the full plant or full flower. Show only one tightly cropped detail such as a petal edge, bud texture, seed pod surface, leaf vein, thorn, root fiber, pollen structure, or stem surface. The image must feel incomplete, suspenseful, and partial. Strictly no full specimen visible.",
  rehook:
    "MOMENT — RE-HOOK (SHOT TYPE: DYNAMIC DIAGONAL COMPOSITION): The subject cuts across the frame at a strong diagonal angle, at larger scale than the hook, with higher contrast, deeper shadow, and heavier blueprint measurement brackets and construction lines. Must feel more dramatic and more graphic than the hook.",
  dangle_2:
    "MOMENT — DANGLE 2 (SHOT TYPE: SCIENTIFIC BREAKDOWN PLATE): Do NOT show a normal full specimen. Show cross sections, internal anatomy, magnified tissue panels, cutaway diagrams, detail circles with leader lines, and numeric markers. Investigative and technical feel. Multiple inset panels acceptable.",
  verified_truth:
    "MOMENT — VERIFIED TRUTH (SHOT TYPE: EVIDENCE BOARD LAYOUT): Must include a structured A, B, C, D anatomical row or grouped detail panels of separated specimen parts. Use labeled parts, figure callouts (Fig. 1, Fig. 2), measurement references, and a clean organized reveal. Most credible, research based plate. Not a single hero specimen.",
  close:
    "MOMENT — CLOSE (SHOT TYPE: FINAL MINIMAL ARCHIVE PLATE): One clean centered specimen with significantly more negative space than the other plates, a subtle golden ratio diagram, a small archival footer, and minimal annotations. Calm, premium, resolved, quiet.",
};

export const COMPOSITION_VARIETY_RULE =
  "The six images MUST NOT look like six variations of the same full botanical poster. They must share the exact same visual style (paper, palette, typography, blueprint language), but each moment must have a clearly different shot type and composition as specified in its moment brief.";

export function buildPlatePrompt(subject: string, moment: Moment): string {
  const subj = (subject ?? "").trim() || "the selected botanical subject";
  return [
    PLATE_STYLE_BLOCK,
    "",
    MOMENT_BRIEFS[moment],
    "",
    `SUBJECT: ${subj}.`,
    "",
    COMPOSITION_VARIETY_RULE,
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
