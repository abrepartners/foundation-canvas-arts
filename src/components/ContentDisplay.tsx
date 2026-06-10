import { Button } from "@/components/ui/button";
import { RotateCcw, Copy, Check, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ContentWithId, FacelessVisual } from "@/hooks/useBotanicalContent";
import { RegenerateVisualDialog } from "@/components/RegenerateVisualDialog";
import type { PlateSubject } from "@/lib/plateTemplate";

type RegenerateFn = (
  moment: string,
  prompt: string,
  subject?: PlateSubject
) => Promise<string | null>;

interface ContentDisplayProps {
  content: ContentWithId;
  onReset: () => void;
  onRegenerateVisual?: RegenerateFn;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 w-8 p-0">
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

// Strip leading section labels (Hook:, Dangle 1:, Payoff:, etc.) and timing
// labels (0-4s:, (0-4s), 0:00-0:04, etc.) from the START of each line or
// paragraph only. Mid-sentence words like "hook", "close", "truth" are left
// intact. Used ONLY for the copy-to-clipboard text; on-screen display is
// unchanged.
function cleanScript(text: string): string {
  const labelWord =
    "(?:hook|re[-\\s]?hook|rehook|dangle\\s*(?:1|one|2|two)|payoff|verified\\s*truth|close)";
  // Matches a label optionally wrapped in brackets/parens, optionally followed
  // by a timing label, then a separator (colon, dash, em/en dash).
  const labelLine = new RegExp(
    `^\\s*[\\[\\(]?\\s*${labelWord}\\s*[\\)\\]]?` +
      `(?:\\s*[\\[\\(]?\\s*\\d{1,2}(?::\\d{2})?\\s*(?:-|to|through|–|—)\\s*\\d{1,2}(?::\\d{2})?\\s*(?:s|sec|seconds)?\\s*[\\)\\]]?)?` +
      `\\s*[:\\-–—]\\s*`,
    "i",
  );
  // Standalone timing labels at start of line: "0-4s:", "(0-4s)", "0:00 to 0:04".
  const timingLine = new RegExp(
    `^\\s*[\\[\\(]?\\s*\\d{1,2}(?::\\d{2})?\\s*(?:-|to|through|–|—)\\s*\\d{1,2}(?::\\d{2})?\\s*(?:s|sec|seconds)?\\s*[\\)\\]]?\\s*[:\\-–—]?\\s*`,
    "i",
  );
  return text
    .split(/\n/)
    .map((line) => {
      let out = line;
      const before = out;
      out = out.replace(labelLine, "");
      if (out === before) out = out.replace(timingLine, "");
      return out;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ScriptSection({ script }: { script: ContentWithId["script"] }) {
  const sections = [
    { label: "Hook", timing: "0-4s", content: script.hook },
    { label: "Dangle 1", timing: "4-9s", content: script.dangle_1 },
    { label: "Re-hook", timing: "9-14s", content: script.rehook },
    { label: "Dangle 2", timing: "14-20s", content: script.dangle_2 },
    { label: "Payoff", timing: "20-25s", content: script.payoff },
    { label: "Verified Truth", timing: "25-32s", content: script.verified_truth },
    { label: "Close", timing: "32-35s", content: script.close },
  ];

  const fullScript = sections.map(s => s.content).join("\n\n");
  const copyScript = cleanScript(fullScript);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-foreground">Script</h3>
        <CopyButton text={copyScript} />
      </div>
      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.label} className="border-l-2 border-muted pl-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-primary">{section.label}</span>
              <span className="text-xs text-muted-foreground">({section.timing})</span>
            </div>
            <p className="text-sm text-foreground/90 font-body">{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const momentLabels: Record<string, string> = {
  hook: "Hook",
  dangle_1: "Dangle 1",
  rehook: "Re-hook",
  dangle_2: "Dangle 2",
  verified_truth: "Verified Truth",
  close: "Close"
};

const momentOrder = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"];

function FacelessVisualsSection({
  visuals,
  onRegenerate,
}: {
  visuals: FacelessVisual[];
  onRegenerate?: RegenerateFn;
}) {
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set());
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [dialogMoment, setDialogMoment] = useState<string | null>(null);

  // Sort visuals by script flow order
  const sortedVisuals = [...visuals].sort(
    (a, b) => momentOrder.indexOf(a.moment) - momentOrder.indexOf(b.moment)
  );

  const allPrompts = sortedVisuals
    .map((v) => `[${momentLabels[v.moment]}]\n${v.prompt}`)
    .join("\n\n---\n\n");

  const togglePrompt = (idx: number) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const openDialog = (moment: string) => {
    if (!onRegenerate || regenerating) return;
    setDialogMoment(moment);
  };

  const dialogVisual = sortedVisuals.find((v) => v.moment === dialogMoment) ?? null;

  const handleSubmit = async (subject: PlateSubject) => {
    if (!onRegenerate || !dialogVisual) return;
    setRegenerating(dialogVisual.moment);
    try {
      await onRegenerate(dialogVisual.moment, dialogVisual.prompt, subject);
      setDialogMoment(null);
    } finally {
      setRegenerating(null);
    }
  };

  const imagesGenerated = sortedVisuals.filter((v) => v.image_url).length;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-foreground">Faceless Visuals</h3>
        <CopyButton text={allPrompts} />
      </div>
      <p className="text-xs text-muted-foreground">
        {visuals.length} unique moments • {imagesGenerated} images generated
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {sortedVisuals.map((visual, idx) => {
          const isRegenerating = regenerating === visual.moment;
          const hasImage = !!visual.image_url;
          const hasError = !!visual.error;

          return (
            <div key={idx} className="space-y-2">
              <div className="aspect-[9/16] rounded-lg overflow-hidden bg-muted/50 border border-border relative group">
                {hasImage ? (
                  <>
                    <img
                      src={visual.image_url!}
                      alt={`${momentLabels[visual.moment]} visual`}
                      className="w-full h-full object-cover"
                    />
                    {onRegenerate && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openDialog(visual.moment)}
                          disabled={isRegenerating}
                          className="text-xs"
                        >
                          {isRegenerating ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          Regenerate
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 text-center">
                    {hasError ? (
                      <p className="text-[10px] text-destructive font-body leading-tight line-clamp-3">
                        {visual.error}
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {onRegenerate ? "Pending…" : "No image"}
                      </span>
                    )}
                    {onRegenerate && (
                      <Button
                        variant={hasError ? "default" : "ghost"}
                        size="sm"
                        onClick={() => openDialog(visual.moment)}
                        disabled={isRegenerating}
                        className="text-xs"
                      >
                        {isRegenerating ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        {hasError ? "Retry" : "Generate"}
                      </Button>
                    )}
                  </div>
                )}

                {isRegenerating && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-primary">
                  {momentLabels[visual.moment]}
                </span>
                <div className="flex items-center gap-1">
                  {onRegenerate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDialog(visual.moment)}
                      disabled={isRegenerating}
                      className="h-6 px-2 text-xs"
                      title="Regenerate this image"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => togglePrompt(idx)}
                    className="h-6 px-2 text-xs"
                  >
                    {expandedPrompts.has(idx) ? "Hide" : "Prompt"}
                  </Button>
                  <CopyButton text={visual.prompt} />
                </div>
              </div>

              {expandedPrompts.has(idx) && (
                <p className="text-xs text-foreground/80 font-body whitespace-pre-wrap bg-muted/30 rounded p-2">
                  {visual.prompt}
                </p>
              )}
            </div>
          );
        })}

      </div>

      {dialogVisual && (
        <RegenerateVisualDialog
          open={!!dialogMoment}
          onOpenChange={(open) => {
            if (!open && !regenerating) setDialogMoment(null);
          }}
          momentLabel={momentLabels[dialogVisual.moment]}
          currentPrompt={dialogVisual.prompt}
          isRegenerating={regenerating === dialogVisual.moment}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function ContentCard({ title, children, copyText }: { title: string; children: React.ReactNode; copyText?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-serif text-lg text-foreground">{title}</h3>
        {copyText && <CopyButton text={copyText} />}
      </div>
      {children}
    </div>
  );
}

export function ContentDisplay({ content, onReset, onRegenerateVisual }: ContentDisplayProps) {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-foreground">{content.plant_name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{content.verified_fact}</p>
        </div>
        <Button variant="outline" onClick={onReset} className="font-body">
          <RotateCcw className="mr-2 h-4 w-4" />
          Generate New
        </Button>
      </div>

      <div className="space-y-4">
        <ScriptSection script={content.script} />

        {content.faceless_visuals?.length > 0 && (
          <FacelessVisualsSection 
            visuals={content.faceless_visuals} 
            onRegenerate={onRegenerateVisual}
          />
        )}

        <ContentCard 
          title={`Thumbnail Prompt (${content.thumbnail_prompt.mode})`} 
          copyText={content.thumbnail_prompt.prompt}
        >
          <p className="text-sm text-foreground/90 font-body whitespace-pre-wrap">
            {content.thumbnail_prompt.prompt}
          </p>
        </ContentCard>

        <ContentCard title="Caption" copyText={content.caption}>
          <p className="text-sm text-foreground/90 font-body whitespace-pre-wrap">
            {content.caption}
          </p>
        </ContentCard>

        <ContentCard title="Part 2 Hook" copyText={content.part2_hook}>
          <p className="text-sm text-foreground/90 font-body whitespace-pre-wrap">
            {content.part2_hook}
          </p>
        </ContentCard>
      </div>
    </div>
  );
}
