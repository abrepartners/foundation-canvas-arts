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

SPECIMEN RENDERING (NON-NEGOTIABLE): The botanical subject itself must always be rendered as a photo-realistic, museum-grade botanical illustration with true-to-life petal texture, depth, soft shadow, and dimensional form. Never a flat line drawing, never a graphite sketch, never a wireframe, never a pure blueprint outline of the subject. Blueprint construction lines, measurement brackets, callouts, leader lines, and annotations are layered AROUND and ON TOP of the realistic specimen — they never replace it.

AVOID: people, modern elements, neon, cartoon style, bright colors, glossy advertising style, Canva style layouts, white backgrounds, random decorative elements, clutter, text heavy graphics, flat sketch renderings of the subject, pencil-only drawings of the subject, wireframe-only specimens, and line-art-only flowers or leaves.`;

export const MOMENT_BRIEFS: Record<Moment, string> = {
  hook:
    "MOMENT — HOOK (SHOT TYPE: FULL HERO SPECIMEN): One large complete photo-realistic botanical subject filling most of the vertical frame. Dramatic, mysterious, scroll stopping. This plate CAN show the full subject. Heavy upper left directional light, deep vignette.",
  dangle_1:
    "MOMENT — DANGLE 1 (SHOT TYPE: EXTREME MACRO CLUE ONLY): Do NOT show the full plant or full flower. Show only one tightly cropped photo-realistic detail such as a petal edge, bud texture, seed pod surface, leaf vein, thorn, root fiber, pollen structure, or stem surface. The image must feel incomplete, suspenseful, and partial. Strictly no full specimen visible. The cropped detail itself is still rendered as realistic botanical illustration — not a sketch.",
  rehook:
    "MOMENT — RE-HOOK (SHOT TYPE: DIAGONAL HERO WITH HEAVY BLUEPRINT OVERLAY): The same photo-realistic specimen as the hook, rendered at full photoreal fidelity, but composed on a strong diagonal axis cutting across the frame at larger scale, with deeper shadow, higher contrast, and heavier blueprint measurement brackets, construction lines, and figure labels overlaid around it. The subject itself must remain a realistic botanical illustration — NOT a sketch, NOT a line drawing, NOT a graphite outline. Only the composition angle and overlay density change.",
  dangle_2:
    "MOMENT — DANGLE 2 (SHOT TYPE: PHOTOREAL SCIENTIFIC BREAKDOWN): Multiple inset panels showing cross sections, internal anatomy, and magnified tissue — each panel rendered as a photo-realistic botanical illustration with true texture, depth, and dimensional form, NOT as line drawings or pencil sketches. Detail circles with leader lines and numeric markers connect the panels. The investigative, technical feel comes from the panel layout and annotations, never from flattening the specimen into a sketch.",
  verified_truth:
    "MOMENT — VERIFIED TRUTH (SHOT TYPE: PHOTOREAL EVIDENCE BOARD): A structured A, B, C, D row or grouped panels of separated specimen parts (petal, stem segment, bud, leaf, seed, etc.), each part rendered as a photo-realistic museum-grade botanical illustration. Figure callouts (Fig. 1, Fig. 2), measurement references, and labels sit beside the realistic parts. Most credible, research based plate. The parts themselves are never sketches, wireframes, or outlines.",
  close:
    "MOMENT — CLOSE (SHOT TYPE: FINAL MINIMAL ARCHIVE PLATE): One clean centered photo-realistic specimen with significantly more negative space than the other plates, a subtle golden ratio diagram, a small archival footer, and minimal annotations. Calm, premium, resolved, quiet.",
};

export const COMPOSITION_VARIETY_RULE =
  "The six images MUST NOT look like six variations of the same full botanical poster. They must share the exact same visual style (paper, palette, typography, blueprint language, AND photoreal specimen rendering), but each moment must have a clearly different shot type and composition as specified in its moment brief. Composition variety must NEVER be achieved by switching the subject from photoreal to sketch — the specimen is always photoreal across all six plates.";

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
