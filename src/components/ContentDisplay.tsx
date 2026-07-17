import { invokeFn } from "@/lib/invokeFn";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RotateCcw, Copy, Check, RefreshCw, Loader2, History, Sparkles, Send, X as XIcon } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ContentWithId, FacelessVisual, VisualHistoryEntry } from "@/hooks/useBotanicalContent";
import { getDisplayTitle, stripCaptionTitle } from "@/lib/captionTitle";

type SendPhase =
  | "idle"
  | "initializing"
  | "uploading"
  | "processing"
  | "in_drafts"
  | "timeout"
  | "failed";

const SEND_STEPS: { key: SendPhase; label: string }[] = [
  { key: "initializing", label: "Initializing" },
  { key: "uploading", label: "Uploading to TikTok" },
  { key: "processing", label: "Processing" },
  { key: "in_drafts", label: "In your drafts" },
];

function SendProgress({
  phase,
  detail,
  onDismiss,
}: {
  phase: SendPhase;
  detail?: string;
  onDismiss: () => void;
}) {
  if (phase === "idle") return null;
  const currentIdx = SEND_STEPS.findIndex((s) => s.key === phase);
  const isFailed = phase === "failed";
  const isDone = phase === "in_drafts";
  const isTimeout = phase === "timeout";
  const progressValue = isDone
    ? 100
    : isFailed || isTimeout
    ? 100
    : Math.max(10, ((currentIdx + 0.5) / SEND_STEPS.length) * 100);

  return (
    <div className="w-full rounded-md border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-body text-foreground">
          {isDone
            ? "Carousel is now a draft in your TikTok inbox."
            : isFailed
            ? "TikTok rejected the carousel."
            : isTimeout
            ? "Still processing on TikTok's side — check the app in a minute."
            : "Sending to TikTok…"}
        </p>
        {(isDone || isFailed || isTimeout) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-7 px-2 text-xs"
          >
            Dismiss
          </Button>
        )}
      </div>
      <Progress
        value={progressValue}
        className={isFailed ? "[&>div]:bg-destructive" : isDone ? "[&>div]:bg-green-600" : ""}
      />
      <ol className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-body">
        {SEND_STEPS.map((step, i) => {
          const done = !isFailed && (isDone || i < currentIdx);
          const active = !isDone && !isFailed && !isTimeout && i === currentIdx;
          const failedHere = isFailed && i === Math.max(currentIdx, 0);
          return (
            <li key={step.key} className="flex items-center gap-1.5">
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                  failedHere
                    ? "border-destructive bg-destructive text-destructive-foreground"
                    : done
                    ? "border-green-600 bg-green-600 text-white"
                    : active
                    ? "border-botanical text-botanical animate-pulse"
                    : "border-border text-muted-foreground"
                }`}
              >
                {failedHere ? (
                  <XIcon className="h-3 w-3" />
                ) : done ? (
                  <Check className="h-3 w-3" />
                ) : active ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="h-1 w-1 rounded-full bg-current" />
                )}
              </span>
              <span
                className={
                  failedHere
                    ? "text-destructive"
                    : done || active
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {detail && (
        <p
          className={`text-xs font-body ${
            isFailed ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {detail}
        </p>
      )}
    </div>
  );
}


interface ContentDisplayProps {
  content: ContentWithId;
  onReset: () => void;
  onRegenerateVisual?: (moment: string) => Promise<string | null>;
  onRegenerateAll?: () => Promise<void>;
  onRestoreVersion?: (moment: string, entry: VisualHistoryEntry) => Promise<string | null>;
  onRegenerateCaption?: () => Promise<string | null>;
  isRegeneratingCaption?: boolean;
  autoResumeExhausted?: boolean;
  onRetryStuck?: () => Promise<void>;
  isRetryingStuck?: boolean;
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
  const inFlightCount = sortedVisuals.filter(
    (v) => (v.status === "queued" || v.status === "generating") && !v.image_url,
  ).length;
  const anyInFlight = inFlightCount > 0 || regenerating.size > 0;

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
              disabled={regenAllRunning || anyInFlight}
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
        {visuals.length} unique moments • {imagesGenerated} ready
        {inFlightCount > 0 && ` • ${inFlightCount} in progress`}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {sortedVisuals.map((visual, idx) => {
          const isRegenerating = regenerating.has(visual.moment);
          const hasImage = !!visual.image_url;
          const hasError = !!visual.error || visual.status === "error";
          const history = visual.history ?? [];
          const historyOpen = expandedHistory.has(visual.moment);
          // A slot is "busy" if backend says queued/generating OR local UI click.
          const backendBusy =
            (visual.status === "queued" || visual.status === "generating") &&
            !hasImage;
          const busy = isRegenerating || backendBusy;
          const statusLabel: { text: string; tone: string } | null = backendBusy
            ? visual.status === "queued"
              ? { text: "Queued", tone: "bg-muted text-muted-foreground border-border" }
              : { text: "Generating…", tone: "bg-primary/15 text-primary border-primary/30 animate-pulse" }
            : hasError
              ? { text: "Failed", tone: "bg-destructive/15 text-destructive border-destructive/30" }
              : hasImage
                ? null
                : null;

          return (
            <div key={idx} className="space-y-2">
              <div className="aspect-[9/16] rounded-lg overflow-hidden bg-muted/50 border border-border relative group">
                {statusLabel && (
                  <span
                    className={`absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-body backdrop-blur ${statusLabel.tone}`}
                  >
                    {visual.status === "generating" && (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    )}
                    {statusLabel.text}
                  </span>
                )}
                {hasImage ? (
                  <>
                    <img
                      src={visual.image_url!}
                      alt={`${momentLabels[visual.moment]} visual`}
                      className="w-full h-full object-cover"
                    />
                    {onRegenerate && (
                      <button
                        type="button"
                        onClick={() => handleRegen(visual.moment)}
                        disabled={busy}
                        title={busy ? "Already generating — please wait" : "Regenerate this image"}
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center text-foreground hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 text-center">
                    {hasError ? (
                      <p className="text-[10px] text-destructive font-body leading-tight line-clamp-3">
                        {visual.error}
                      </p>
                    ) : backendBusy ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
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
                        disabled={busy}
                        className="text-xs"
                      >
                        {busy ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        {busy ? "Working…" : hasError ? "Retry" : "Generate"}
                      </Button>
                    )}
                  </div>
                )}


                {isRegenerating && hasImage && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-primary block">
                  {momentLabels[visual.moment]}
                </span>
                <div className="flex items-center justify-end gap-1 flex-wrap">
                  {history.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleHistory(visual.moment)}
                      className="h-8 px-2 text-xs"
                      title="Previous versions"
                    >
                      <History className="h-3 w-3 mr-0.5" />
                      {history.length}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => togglePrompt(idx)}
                    className="h-8 px-2 text-xs"
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

export function ContentDisplay({ content, onReset, onRegenerateVisual, onRegenerateAll, onRestoreVersion, onRegenerateCaption, isRegeneratingCaption }: ContentDisplayProps) {
  const { toast } = useToast();
  const [sendPhase, setSendPhase] = useState<SendPhase>("idle");
  const [sendDetail, setSendDetail] = useState<string | undefined>(undefined);

  const imageUrls = (content.faceless_visuals ?? [])
    .map((v) => v.image_url)
    .filter((u): u is string => !!u);
  const canSendTikTok = imageUrls.length >= 2;
  const sending =
    sendPhase === "initializing" ||
    sendPhase === "uploading" ||
    sendPhase === "processing";

  const pollJob = async (jobId: string) => {
    const MAX_POLLS = 90; // ~3 min @ 2s
    let consecutiveErrors = 0;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const { data, error } = await invokeFn(
          "tiktok-send-status",
          { body: { job_id: jobId } },
        );
        if (error) throw new Error(error.message);
        consecutiveErrors = 0;

        const serverPhase: string =
          (data as { phase?: string })?.phase ?? "queued";
        const status: string | null =
          (data as { status?: string | null })?.status ?? null;
        const failReason: string | null =
          (data as { fail_reason?: string | null })?.fail_reason ?? null;

        // Map server phase → UI phase
        if (serverPhase === "queued" || serverPhase === "normalizing") {
          setSendPhase("initializing");
        } else if (serverPhase === "initializing") {
          setSendPhase("uploading");
        } else if (serverPhase === "publish_id_received") {
          setSendPhase("processing");
        } else if (serverPhase === "in_drafts") {
          setSendPhase("in_drafts");
          setSendDetail(undefined);
          toast({
            title: "In your TikTok drafts",
            description: "Verified by TikTok — open the app to publish.",
          });
          return;
        } else if (serverPhase === "failed") {
          setSendPhase("failed");
          setSendDetail(failReason ?? "TikTok marked the send as failed.");
          toast({
            title: "TikTok send failed",
            description: failReason ?? "TikTok rejected the carousel.",
            variant: "destructive",
          });
          return;
        }

        // Extra hint from TikTok's own status field
        if (status === "PROCESSING_DOWNLOAD") setSendPhase("uploading");
        else if (status === "PROCESSING_UPLOAD" || status === "PROCESSING")
          setSendPhase("processing");
      } catch (e) {
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          const msg = e instanceof Error ? e.message : "Status check failed";
          setSendPhase("failed");
          setSendDetail(msg);
          toast({
            title: "Status check failed",
            description: msg,
            variant: "destructive",
          });
          return;
        }
      }
    }
    setSendPhase("timeout");
    setSendDetail(
      "TikTok is still processing — check the app shortly, or the Approval Queue for the job record.",
    );
  };

  const handleSendTikTok = async () => {
    if (!canSendTikTok) return;
    setSendPhase("initializing");
    setSendDetail(undefined);
    try {
      const { data, error } = await invokeFn(
        "post-tiktok-carousel",
        {
          body: {
            title: getDisplayTitle(content),
            description: stripCaptionTitle(content.caption),
            photo_images: imageUrls,
            content_id: content.id,
          },
        },
      );
      if (error) throw error;
      if ((data as { error?: string })?.error)
        throw new Error((data as { error: string }).error);
      const jobId = (data as { job_id?: string })?.job_id;
      if (!jobId) {
        throw new Error(
          "Server did not return a job id — cannot verify TikTok delivery.",
        );
      }
      await pollJob(jobId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send to TikTok";
      setSendPhase("failed");
      setSendDetail(msg);
      toast({
        title: "TikTok send failed",
        description: msg,
        variant: "destructive",
      });
    }
  };


  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground/80 font-body">{content.plant_name}</p>
          <h2 className="text-xl md:text-2xl font-serif text-foreground break-words mt-0.5">{getDisplayTitle(content)}</h2>
          <p className="text-sm text-muted-foreground mt-1">{content.verified_fact}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={handleSendTikTok}
            disabled={!canSendTikTok || sending}
            className="font-body flex-1 sm:flex-none"
            title={canSendTikTok ? "Send carousel to TikTok drafts" : "Generate all images first"}
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send to TikTok ({imageUrls.length})
          </Button>
          <Button variant="outline" onClick={onReset} className="font-body flex-1 sm:flex-none">
            <RotateCcw className="mr-2 h-4 w-4" />
            Generate New
          </Button>
        </div>
      </div>

      <SendProgress
        phase={sendPhase}
        detail={sendDetail}
        onDismiss={() => {
          setSendPhase("idle");
          setSendDetail(undefined);
        }}
      />


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

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="font-serif text-lg text-foreground">Caption</h3>
            <div className="flex items-center gap-2">
              {onRegenerateCaption && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRegenerateCaption()}
                  disabled={isRegeneratingCaption}
                  className="text-xs"
                  title="Rewrite caption in the SEO long-form style"
                >
                  {isRegeneratingCaption ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  Regenerate
                </Button>
              )}
              <CopyButton text={content.caption} />
            </div>
          </div>
          <p className="text-sm text-foreground/90 font-body whitespace-pre-wrap">
            {content.caption}
          </p>
        </div>

        <ContentCard title="Part 2 Hook" copyText={content.part2_hook}>
          <p className="text-sm text-foreground/90 font-body whitespace-pre-wrap">
            {content.part2_hook}
          </p>
        </ContentCard>
      </div>
    </div>
  );
}
