// Architectural Botanical Study Plate — locked visual style shared by all six plates.
// Same style across every plate; only the per-moment composition / storytelling purpose changes.
// Subject is dynamic and passed in at call time.
//
// PROMPT PHILOSOPHY (project knowledge — keep this OUT of the final Replicate prompt):
// - The final prompt must be concise and image-directed. No meta instructions,
//   no "non-negotiable" language, no paragraphs explaining why the plates differ.
// - The specimen is always rendered photoreal; composition variety comes from
//   the per-moment shot-type briefs (camera distance, crop, angle, layout,
//   diagram density), never from switching photoreal to sketch.

export type Moment =
  | "hook"
  | "dangle_1"
  | "rehook"
  | "dangle_2"
  | "verified_truth"
  | "close";

// Concise visual style sentence appended after "Create a vertical 9:16
// Architectural Botanical Study Plate of {subject}."
export const PLATE_STYLE_BLOCK =
  "Dark charcoal textured paper, near-black parchment, fine grain, soft vignette, cinematic upper-left lighting, muted ivory, bone, warm gray, sage, olive, faded green, and graphite palette. Realistic botanical specimen with museum-grade depth and texture. Architectural blueprint layout with thin construction lines, measurement brackets, scientific annotations, figure labels, and small numeric markers.";

export const PLATE_AVOID_LINE =
  "Avoid people, modern objects, neon, cartoon style, bright colors, glossy ad style, Canva layouts, white backgrounds, clutter, text-heavy graphics, flat sketches, wireframe-only specimens, and line-art-only flowers or leaves.";

export const PLATE_QUALITY_LINE =
  "High-detail editorial botanical plate, premium archival research aesthetic, realistic specimen, 9:16 vertical.";

export const PLATE_CONSISTENCY_LINE =
  "Use the same Architectural Botanical Study Plate style across all six plates. Only the composition and storytelling purpose change.";

// Per-moment composition briefs — the ONLY thing that changes between plates.
// Shot-type language only; no meta instructions.
export const MOMENT_BRIEFS: Record<Moment, string> = {
  hook: "Full hero specimen. One large complete botanical subject filling most of the vertical frame. Dramatic, mysterious, scroll-stopping. This can show the full subject.",
  dangle_1:
    "Extreme macro clue only. Do not show the full plant or full flower. Show only one cropped detail such as petal edge, bud texture, seed pod, leaf vein, thorn, root fiber, pollen structure, or stem surface. Incomplete and suspenseful.",
  rehook:
    "Dynamic diagonal composition. The subject cuts across the frame at a clear diagonal angle. Larger scale, stronger shadow, higher contrast, more blueprint measurement brackets. More dramatic than the hook, but still archival.",
  dangle_2:
    "Scientific breakdown plate. Do not show a normal full specimen. Show cross sections, internal anatomy, magnified tissue panels, cutaway diagrams, detail circles, numeric markers, and measurement brackets. Investigative and technical.",
  verified_truth:
    "Evidence board layout. Structured A, B, C, D anatomical row or grouped detail panels. Labeled specimen parts, figure callouts, measurement references, clean organized reveal. Most credible and research-based.",
  close:
    "Final minimal archive plate. One clean centered specimen with more negative space, subtle golden-ratio diagram, small archival footer, minimal annotations. Calm, premium, resolved.",
};

const MOMENT_NAMES: Record<Moment, string> = {
  hook: "Hook",
  dangle_1: "Dangle 1",
  rehook: "Re-hook",
  dangle_2: "Dangle 2",
  verified_truth: "Verified Truth",
  close: "Close",
};

export function buildPlatePrompt(subject: string, moment: Moment): string {
  const subj = (subject ?? "").trim() || "the selected botanical subject";
  return [
    `Subject: ${subj}`,
    "",
    `Create a vertical 9:16 Architectural Botanical Study Plate of ${subj}. ${PLATE_STYLE_BLOCK}`,
    "",
    `Moment: ${MOMENT_NAMES[moment]}`,
    MOMENT_BRIEFS[moment],
    "",
    PLATE_AVOID_LINE,
    "",
    PLATE_QUALITY_LINE,
    "",
    PLATE_CONSISTENCY_LINE,
  ].join("\n");
}

export function buildAllPlatePrompts(subject: string): Record<Moment, string> {
  return {
    hook: buildPlatePrompt(subject, "hook"),
    dangle_1: buildPlatePrompt(subject, "dangle_1"),
    rehook: buildPlatePrompt(subject, "rehook"),
    dangle_2: buildPlatePrompt(subject, "dangle_2"),
    verified_truth: buildPlatePrompt(subject, "verified_truth"),
    close: buildPlatePrompt(subject, "close"),
  };
}
