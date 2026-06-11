import { Button } from "@/components/ui/button";
import { RotateCcw, Copy, Check, RefreshCw, Loader2, History, Sparkles, Send } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ContentWithId, FacelessVisual, VisualHistoryEntry } from "@/hooks/useBotanicalContent";

interface ContentDisplayProps {
  content: ContentWithId;
  onReset: () => void;
  onRegenerateVisual?: (moment: string) => Promise<string | null>;
  onRegenerateAll?: () => Promise<void>;
  onRestoreVersion?: (moment: string, entry: VisualHistoryEntry) => Promise<string | null>;
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

function cleanScript(text: string): string {
  const labelWord =
    "(?:hook|re[-\\s]?hook|rehook|dangle\\s*(?:1|one|2|two)|payoff|verified\\s*truth|close)";
  const labelLine = new RegExp(
    `^\\s*[\\[\\(]?\\s*${labelWord}\\s*[\\)\\]]?` +
      `(?:\\s*[\\[\\(]?\\s*\\d{1,2}(?::\\d{2})?\\s*(?:-|to|through|–|—)\\s*\\d{1,2}(?::\\d{2})?\\s*(?:s|sec|seconds)?\\s*[\\)\\]]?)?` +
      `\\s*[:\\-–—]\\s*`,
    "i",
  );
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
  onRegenerateAll,
  onRestoreVersion,
}: {
  visuals: FacelessVisual[];
  onRegenerate?: (moment: string) => Promise<string | null>;
  onRegenerateAll?: () => Promise<void>;
  onRestoreVersion?: (moment: string, entry: VisualHistoryEntry) => Promise<string | null>;
}) {
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set());
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());
  const [regenAllRunning, setRegenAllRunning] = useState(false);

  const sortedVisuals = [...visuals].sort(
    (a, b) => momentOrder.indexOf(a.moment) - momentOrder.indexOf(b.moment)
  );

  const allPrompts = sortedVisuals
    .map((v) => `[${momentLabels[v.moment]}]\n${v.prompt}`)
    .join("\n\n---\n\n");

  const togglePrompt = (idx: number) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleHistory = (moment: string) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(moment)) next.delete(moment); else next.add(moment);
      return next;
    });
  };

  const handleRegen = async (moment: string) => {
    if (!onRegenerate) return;
    setRegenerating((prev) => new Set(prev).add(moment));
    try {
      await onRegenerate(moment);
    } finally {
      setRegenerating((prev) => {
        const next = new Set(prev);
        next.delete(moment);
        return next;
      });
    }
  };

  const handleRegenAll = async () => {
    if (!onRegenerateAll) return;
    if (!window.confirm("Regenerate all 6 visuals using the current locked style? This will move the existing renders into history.")) return;
    setRegenAllRunning(true);
    try {
      await onRegenerateAll();
    } finally {
      setRegenAllRunning(false);
    }
  };

  const handleRestore = async (moment: string, entry: VisualHistoryEntry) => {
    if (!onRestoreVersion) return;
    setRegenerating((prev) => new Set(prev).add(moment));
    try {
      await onRestoreVersion(moment, entry);
    } finally {
      setRegenerating((prev) => {
        const next = new Set(prev);
        next.delete(moment);
        return next;
      });
    }
  };

  const imagesGenerated = sortedVisuals.filter((v) => v.image_url).length;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-serif text-lg text-foreground">Faceless Visuals</h3>
        <div className="flex items-center gap-2">
          {onRegenerateAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenAll}
              disabled={regenAllRunning || regenerating.size > 0}
              className="text-xs"
            >
              {regenAllRunning ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              Regenerate all with new style
            </Button>
          )}
          <CopyButton text={allPrompts} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {visuals.length} unique moments • {imagesGenerated} images generated
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {sortedVisuals.map((visual, idx) => {
          const isRegenerating = regenerating.has(visual.moment);
          const hasImage = !!visual.image_url;
          const hasError = !!visual.error;
          const history = visual.history ?? [];
          const historyOpen = expandedHistory.has(visual.moment);

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
                          onClick={() => handleRegen(visual.moment)}
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
                        onClick={() => handleRegen(visual.moment)}
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
                  {history.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleHistory(visual.moment)}
                      className="h-6 px-2 text-xs"
                      title="Previous versions"
                    >
                      <History className="h-3 w-3 mr-0.5" />
                      {history.length}
                    </Button>
                  )}
                  {onRegenerate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRegen(visual.moment)}
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

              {historyOpen && history.length > 0 && (
                <div className="space-y-1 bg-muted/30 rounded p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Previous versions
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {history.map((h, hi) => (
                      <button
                        key={hi}
                        type="button"
                        onClick={() => handleRestore(visual.moment, h)}
                        disabled={isRegenerating}
                        className="relative flex-shrink-0 w-16 aspect-[9/16] rounded overflow-hidden border border-border hover:border-primary transition-colors group/h"
                        title={`Restore version from ${new Date(h.created_at).toLocaleString()}`}
                      >
                        <img
                          src={h.image_url}
                          alt={`Previous ${momentLabels[visual.moment]}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/h:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[9px] text-white text-center px-1">Use this</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {expandedPrompts.has(idx) && (
                <p className="text-xs text-foreground/80 font-body whitespace-pre-wrap bg-muted/30 rounded p-2">
                  {visual.prompt}
                </p>
              )}
            </div>
          );
        })}
      </div>
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

export function ContentDisplay({ content, onReset, onRegenerateVisual, onRegenerateAll, onRestoreVersion }: ContentDisplayProps) {
  const { toast } = useToast();
  const [sendingTikTok, setSendingTikTok] = useState(false);

  const imageUrls = (content.faceless_visuals ?? [])
    .map((v) => v.image_url)
    .filter((u): u is string => !!u);
  const canSendTikTok = imageUrls.length >= 2;

  const handleSendTikTok = async () => {
    if (!canSendTikTok) return;
    setSendingTikTok(true);
    try {
      const { data, error } = await supabase.functions.invoke("post-tiktok-carousel", {
        body: {
          title: content.plant_name,
          description: content.caption,
          photo_images: imageUrls,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: "Sent to TikTok",
        description: "Open the TikTok app — the carousel is in your inbox as a draft.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send to TikTok";
      toast({ title: "TikTok send failed", description: msg, variant: "destructive" });
    } finally {
      setSendingTikTok(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-serif text-foreground">{content.plant_name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{content.verified_fact}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={handleSendTikTok}
            disabled={!canSendTikTok || sendingTikTok}
            className="font-body"
            title={canSendTikTok ? "Send carousel to TikTok drafts" : "Generate all images first"}
          >
            {sendingTikTok ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send to TikTok ({imageUrls.length})
          </Button>
          <Button variant="outline" onClick={onReset} className="font-body">
            <RotateCcw className="mr-2 h-4 w-4" />
            Generate New
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <ScriptSection script={content.script} />

        {content.faceless_visuals?.length > 0 && (
          <FacelessVisualsSection 
            visuals={content.faceless_visuals} 
            onRegenerate={onRegenerateVisual}
            onRegenerateAll={onRegenerateAll}
            onRestoreVersion={onRestoreVersion}
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
