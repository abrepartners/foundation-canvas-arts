Use the full instruction set below. This replaces the shorter plan. Keep the work scoped to these exact changes only and do not rebuild or refactor unrelated parts.

Copy and paste this whole thing into Lovable.

Before editing, inspect the existing files first and preserve existing working logic. Make the smallest possible diff.

Do not rebuild this feature.

Make two scoped changes only:

1. Update visual prompt construction so the six image prompts use the locked Architectural Botanical Study Plate style with per moment composition briefs.
2. Clean the copied script text so section labels and timing labels are removed from the clipboard copy only.

Do not change UI layout, UI labels, timing display, visual styling, JSON contract, database schema, Replicate routing, regenerate buttons, polling, retry logic, provider toggle, image display behavior, or any unrelated feature.

No new UI controls.  
No new edge function.  
No database migration.  
No unrelated refactor.

Current feature behavior must stay intact:

The system still generates six images.  
The six moments stay the same:

hook  
dangle_1  
rehook  
dangle_2  
verified_truth  
close

The subject must remain dynamic.  
Do not hard code banana, a specific plant, or any fixed subject.  
Use whatever subject the current AI selection or user input already provides.

PART A

Update the visual prompt construction

Goal:

Replace the old Warm Botanical Plate wording and the old every plate must be identical rule with a locked Architectural Botanical Study Plate style.

The new rule is:

Same visual style across all six images.  
Different composition and storytelling purpose for each moment.

Locked style name:

Architectural Botanical Study Plate

Locked style block:

Vertical 9:16 dark mode botanical study plate. Deep charcoal textured paper. Near black parchment background. Fine paper grain. Soft vignette. Cinematic upper left directional lighting. Muted ivory, bone, warm gray, sage, olive, faded green, graphite, and aged natural tones. Realistic botanical or organic specimen illustration. Architectural blueprint layout. Fine graphite construction lines. Measurement brackets. Scientific annotations. Figure labels. Small numeric markers. Subtle museum style serif typography. Premium archival research aesthetic.

Avoid:

People.  
Modern elements.  
Neon.  
Cartoon style.  
Bright colors.  
Glossy advertising style.  
Canva style layouts.  
White backgrounds.  
Random decorative elements.  
Clutter.  
Text heavy graphics.

Per moment composition briefs:

hook:

Boldest plate. Large hero specimen filling most of the frame. Mysterious, scroll stopping, dramatic upper left light, deep vignette.

dangle_1:

Close up clue. Partial reveal. One isolated detail such as a leaf edge, bud, tendril, root, seed, flower part, fruit surface, or botanical texture cropped tight. Suspenseful. Does not show the whole subject.

rehook:

Second visual punch. Stronger angle, higher contrast, larger scale, more construction lines and brackets framing the specimen.

dangle_2:

Investigative detail. Cross section, anatomy, hidden internal structure, magnified scientific breakdown, measurement brackets, numeric markers.

verified_truth:

Most credible plate. Organized evidence layout. Labeled A, B, C, D anatomical row. Figure annotations. Clean structured reveal.

close:

Final archive plate. Calm, resolved, premium, minimal. Single specimen, golden ratio diagram, small archival footer feel.

File 1:

src/lib/architecturalPlate.ts

Create this new file.

It should export:

type Moment = “hook” | “dangle_1” | “rehook” | “dangle_2” | “verified_truth” | “close”

PLATE_STYLE_BLOCK

MOMENT_BRIEFS: Record<Moment, string>

buildPlatePrompt(subject: string, moment: Moment): string

buildAllPlatePrompts(subject: string): Record<Moment, string>

buildPlatePrompt must return one fully standalone Replicate ready prompt.

The generated prompt must include:

The locked Architectural Botanical Study Plate style block.  
The correct per moment composition brief.  
The dynamic subject.  
The avoid list.  
The closing consistency line.

Closing consistency line:

Use the exact same Architectural Botanical Study Plate style across all six plates. Only the composition and storytelling purpose change. Subject: {subject}.

buildAllPlatePrompts must return all six prompts keyed by the Moment value.

File 2:

supabase/functions/generate-botanical-content/index.ts

Mirror PLATE_STYLE_BLOCK and MOMENT_BRIEFS as Deno constants near the top of this file.

Do this because Supabase edge functions may not import from src.

Replace the old Warm Botanical Plate block and the old every plate must be identical rules with:

The new Architectural Botanical Study Plate style block.  
The six per moment composition briefs.  
A clear instruction that each faceless_visuals[i].prompt must be a fully standalone Replicate ready prompt.

Each faceless_visuals[i].prompt must restate the full style block and apply the correct moment brief to the selected subject.

Keep untouched:

Six moment validation.  
Dedupe.  
JSON contract.  
Replicate routing.  
Parallel generation.  
Retry and backoff logic.  
Subject selection.  
Novelty guard.  
Database behavior.  
Response shape.

Also add this instruction inside the SCRIPT STRUCTURE section:

Do NOT include section labels such as Hook:, Dangle 1:, Payoff:, Verified Truth:, Close:, or timing labels like 0 to 4s inside the script text. Output only the spoken words for each section.

File 3:

supabase/functions/regenerate-visual/index.ts

Mirror the same PLATE_STYLE_BLOCK and MOMENT_BRIEFS constants.

When regenerating a single visual, rebuild the prompt using the same template logic.

Use:

The passed moment.  
The subject fields already collected by RegenerateVisualDialog.  
The matching moment brief.  
The full locked Architectural Botanical Study Plate style block.

The regenerated prompt must stay consistent with the batch generated images and must match its specific moment purpose.

Do not change:

Replicate call.  
Storage upload.  
Response shape.  
Regenerate button behavior.  
Existing dialog behavior unless absolutely required.

File 4:

src/lib/plateTemplate.ts

Leave this file in place.

Add a one line deprecated comment above PLATE_TEMPLATE:

// @deprecated Use buildPlatePrompt from architecturalPlate.ts instead.

Rewrite composePlatePrompt so it delegates to buildPlatePrompt from src/lib/architecturalPlate.ts.

If an explicit Moment value exists, use it.

If only momentNote exists, infer the closest Moment using simple keyword matching.

Suggested mapping:

hook maps to hook.  
dangle 1 maps to dangle_1.  
dangle one maps to dangle_1.  
rehook maps to rehook.  
re hook maps to rehook.  
dangle 2 maps to dangle_2.  
dangle two maps to dangle_2.  
verified truth maps to verified_truth.  
payoff maps to verified_truth.  
close maps to close.

If no confident match exists, fallback to hook.

Existing imports should keep working without call site changes unless absolutely necessary.

File 5:

mem://style/botanical-study-plates

Update the memory body to describe:

The new Architectural Botanical Study Plate style.  
The six per moment composition briefs.  
The rule that all six images share the same style but have different storytelling composition purposes.

Remove or replace the old all plates identical rule.

Keep the index entry the same.

PART B

Clean copied script text only

File 6:

src/components/ContentDisplay.tsx

Only update ScriptSection.

Add a cleanScript(text) helper.

The helper should strip common section prefixes only when they appear at the beginning of a line or paragraph.

The displayed script must remain unchanged.

Only the CopyButton text prop for the full script should receive the cleaned version.

CopyButton should receive:

cleanScript(fullScript)

Do not clean or change:

On screen script display.  
Section labels.  
Timing labels shown in the UI.  
Styling.  
Layout.  
Other copy buttons.  
Visual prompt copy button.  
Caption copy button.  
Part 2 hook copy button.  
Thumbnail copy button.

cleanScript should remove labels like these when they appear at the beginning of a line or paragraph:

Hook:  
Hook  
Hook —  
Hook -  
Dangle 1:  
Dangle One:  
Re-hook:  
Rehook:  
Re Hook:  
Dangle 2:  
Dangle Two:  
Payoff:  
Verified Truth:  
Close:

It should also remove timing labels like these when they appear at the beginning of a line or paragraph:

0-4s:  
0 to 4s:  
0 to 4 seconds:  
(0-4s)  
[0-4s]  
0:00-0:04  
0:00 to 0:04  
0:00 through 0:04

The regex must be anchored to the start of each line or paragraph.

Do not remove words like hook, close, truth, payoff, or dangle if they appear naturally in the middle of a sentence.

Only remove labels at the beginning.

Example:

Hook: Most people think this plant is simple.

Copied version should become:

Most people think this plant is simple.

Example:

Most people miss the hook hidden in this plant.

Copied version should stay:

Most people miss the hook hidden in this plant.

What must not change:

UI layout.  
UI labels.  
Timing display.  
Visual styling.  
JSON contract.  
Database schema.  
All other copy buttons.  
Replicate routing.  
Regenerate buttons.  
Provider toggle.  
Polling.  
Retry logic.  
No new UI.  
No new edge function.  
No DB migration.

Verification after implementation:

1. Generate one package through Replicate.
2. Confirm all six faceless_visuals prompts restate the full Architectural Botanical Study Plate style.
3. Confirm all six prompts use the same style but have different per moment composition briefs.
4. Confirm the subject is dynamic and not hard coded.
5. Generate twice and confirm different subjects can still work.
6. Regenerate one plate and confirm the regenerated prompt uses the same locked style and the correct moment brief.
7. Copy the full script and confirm labels like Hook:, Dangle 1:, Payoff:, Verified Truth:, Close:, and timing labels are removed from the copied text.
8. Confirm the on screen script still shows labels and timings unchanged.
9. Confirm all other copy buttons are untouched.
10. Confirm no unrelated files or behavior were changed.

After implementation, summarize the exact files changed and confirm whether any unexpected changes were made.