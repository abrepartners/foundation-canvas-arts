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
  "High-detail editorial botanical plate, premium archival research aesthetic, photorealistic specimen with true texture and depth, 9:16 vertical.";

export const PLATE_CONSISTENCY_LINE =
  "Use the same Architectural Botanical Study Plate style across all six plates. Only the composition and storytelling purpose change.";

// Per-moment composition briefs — the ONLY thing that changes between plates.
// Shot-type language only; no meta instructions.
export const MOMENT_BRIEFS: Record<Moment, string> = {
  hook: "Full hero specimen shot from a low camera angle looking slightly up, one large complete botanical subject filling the frame and emerging from darkness. Dramatic, mysterious, scroll-stopping.",
  dangle_1:
    "Extreme macro photograph, camera inches from the surface with shallow depth of field. One cropped detail only, such as petal edge, bud texture, seed pod, leaf vein, thorn, root fiber, or stem surface. Never the full plant. Incomplete and suspenseful.",
  rehook:
    "Hard diagonal composition, the specimen slashes corner to corner across the frame at a steep 45-degree angle, larger than life scale, deep shadows, high contrast. The most dramatic plate, but still archival.",
  dangle_2:
    "Overhead dissection table, top-down flat lay of cross sections, split-open specimen halves, internal anatomy, magnified tissue circles, and numeric markers. No whole intact specimen. Investigative and technical.",
  verified_truth:
    "Organized evidence board, top-down view of separated specimen parts laid out in a clean labeled A, B, C, D row: petal, stem segment, bud, leaf, seed, with figure callouts and measurement references. Most structured and credible plate.",
  close:
    "Final minimal archive plate, one small clean specimen centered with generous negative space around it, subtle golden-ratio diagram, small archival footer, minimal annotations. Calm, premium, resolved.",
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
