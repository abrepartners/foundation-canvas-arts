import { invokeFn } from "@/lib/invokeFn";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RotateCcw, Copy, Check, RefreshCw, Loader2, History, Sparkles, Send, X as XIcon, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
            ? "Delivery status is unavailable. Check TikTok drafts before retrying."
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
  autoResumeExhausted,
  onRetryStuck,
  isRetryingStuck,
}: {
  visuals: FacelessVisual[];
  onRegenerate?: (moment: string) => Promise<string | null>;
  onRegenerateAll?: () => Promise<void>;
  onRestoreVersion?: (moment: string, entry: VisualHistoryEntry) => Promise<string | null>;
  autoResumeExhausted?: boolean;
  onRetryStuck?: () => Promise<void>;
  isRetryingStuck?: boolean;
}) {
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set());
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());
  const [regenAllRunning, setRegenAllRunning] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Track when each moment first entered a "generating/queued" state locally,
  // so we can show elapsed time even when the backend hasn't stamped started_at.
  const startedAtRef = useRef<Record<string, number>>({});
  const anyPending = visuals.some((v) => !v.image_url && v.status !== "error");

  useEffect(() => {
    for (const v of visuals) {
      const pending = !v.image_url && v.status !== "error";
      if (pending && !startedAtRef.current[v.moment]) {
        startedAtRef.current[v.moment] = Date.now();
      }
      if (v.image_url || v.status === "error") {
        delete startedAtRef.current[v.moment];
      }
    }
  }, [visuals]);

  useEffect(() => {
    if (!anyPending && !regenerating.size) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [anyPending, regenerating.size]);

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

  const readyCount = sortedVisuals.filter((v) => v.image_url).length;
  const failedCount = sortedVisuals.filter(
    (v) => !v.image_url && (v.status === "error" || !!v.error),
  ).length;
  const generatingCount = sortedVisuals.filter(
    (v) => !v.image_url && (v.status === "queued" || v.status === "generating" || regenerating.has(v.moment)) && v.status !== "error",
  ).length;
  const anyInFlight = generatingCount > 0;

  // Overall elapsed since the oldest pending slot started.
  const pendingStarts = Object.values(startedAtRef.current);
  const overallElapsedMs = pendingStarts.length ? now - Math.min(...pendingStarts) : 0;

  const fmtElapsed = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${(s % 60).toString().padStart(2, "0")}s`;
  };

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

      {/* Summary strip */}
      <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-body">
        <span className="text-foreground">
          <span className="font-medium">{readyCount} / {sortedVisuals.length}</span> ready
        </span>
        {generatingCount > 0 && (
          <span className="text-primary inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {generatingCount} generating
          </span>
        )}
        {failedCount > 0 && (
          <span className="text-destructive">{failedCount} failed</span>
        )}
        {anyInFlight && overallElapsedMs > 0 && (
          <span className="text-muted-foreground tabular-nums">· elapsed {fmtElapsed(overallElapsedMs)}</span>
        )}
        {onRetryStuck && (failedCount > 0 || (autoResumeExhausted && generatingCount > 0)) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetryStuck()}
            disabled={isRetryingStuck}
            className="ml-auto text-xs h-7"
            title="Kick off a fresh Replicate attempt for pending or failed slots"
          >
            {isRetryingStuck ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Retry stuck
          </Button>
        )}
        {autoResumeExhausted && generatingCount > 0 && (
          <span className="basis-full text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Auto-retry paused to avoid extra Replicate charges. Click "Retry stuck" to try again.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {sortedVisuals.map((visual, idx) => {
          const isRegenerating = regenerating.has(visual.moment);
          const hasImage = !!visual.image_url;
          const hasError = !hasImage && (!!visual.error || visual.status === "error");
          const history = visual.history ?? [];
          const historyOpen = expandedHistory.has(visual.moment);

          // Unified state model: Ready | Generating | Failed | Queued
          const state: "ready" | "generating" | "failed" | "queued" = hasImage
            ? "ready"
            : hasError
              ? "failed"
              : (isRegenerating || visual.status === "generating")
                ? "generating"
                : "queued";
          const busy = state === "generating" || state === "queued";

          const startedAt = startedAtRef.current[visual.moment];
          const elapsedMs = startedAt ? now - startedAt : 0;
          const takingLong = state === "generating" && elapsedMs > 90_000;

          const badge = (() => {
            if (state === "ready") return null;
            if (state === "generating") {
              return {
                text: `Generating · ${fmtElapsed(elapsedMs)}`,
                tone: "bg-primary/15 text-primary border-primary/30 animate-pulse",
                icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
              };
            }
            if (state === "failed") {
              return {
                text: "Failed",
                tone: "bg-destructive/15 text-destructive border-destructive/30",
                icon: null,
              };
            }
            return {
              text: "Queued",
              tone: "bg-muted text-muted-foreground border-border",
              icon: null,
            };
          })();

          return (
            <div key={idx} className="space-y-2">
              <div className="aspect-[9/16] rounded-lg overflow-hidden bg-muted/50 border border-border relative group">
                {badge && (
                  <span
                    className={`absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-body backdrop-blur ${badge.tone}`}
                  >
                    {badge.icon}
                    {badge.text}
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
                    {state === "failed" && visual.error ? (
                      <p className="text-[10px] text-destructive font-body leading-tight line-clamp-4">
                        {visual.error}
                      </p>
                    ) : state === "generating" ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
                        {takingLong && (
                          <p className="text-[10px] text-muted-foreground font-body leading-tight">
                            Taking longer than usual…
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Waiting…</span>
                    )}
                    {onRegenerate && state === "failed" && (
                      <Button
                        variant={state === "failed" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleRegen(visual.moment)}
                        disabled={busy}
                        className="text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {state === "failed" ? "Retry" : "Generate"}
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

export function ContentDisplay({ content, onReset, onRegenerateVisual, onRegenerateAll, onRestoreVersion, onRegenerateCaption, isRegeneratingCaption, autoResumeExhausted, onRetryStuck, isRetryingStuck }: ContentDisplayProps) {
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
          const technicalMessage =
            e instanceof Error ? e.message : "Status check failed";
          const msg =
            "The send started, but its delivery status could not be checked. Check TikTok drafts before sending again.";
          setSendPhase("timeout");
          setSendDetail(`${msg} (${technicalMessage})`);
          toast({
            title: "TikTok status unavailable",
            description: msg,
          });
          return;
        }
      }
    }
    setSendPhase("timeout");
    setSendDetail(
      "TikTok has not returned a final status yet. Check drafts before sending again, or review the Approval Queue for the job record.",
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
            autoResumeExhausted={autoResumeExhausted}
            onRetryStuck={onRetryStuck}
            isRetryingStuck={isRetryingStuck}
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
