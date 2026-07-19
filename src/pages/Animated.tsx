import { invokeFn, readFnError } from "@/lib/invokeFn";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, Loader2, Play, Download, Sparkles, RotateCw, StopCircle } from "lucide-react";
import { AnimationPromptLab } from "@/components/AnimationPromptLab";

interface Step {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  started_at?: string;
  ended_at?: string;
}

interface CostBreakdown {
  stills?: { total_usd: number; count?: number };
  clips?: { total_usd: number; mode?: string; total_seconds?: number };
  stitch?: { total_usd: number };
}

interface AnimatedRow {
  id: string;
  plant_name: string | null;
  verified_fact: string | null;
  caption: string | null;
  still_urls: string[] | null;
  clip_urls: string[] | null;
  final_video_url: string | null;
  queue_status: string;
  error: string | null;
  progress: { stage?: string; steps?: Step[] } | null;
  created_at: string;
  updated_at?: string;
  cost_breakdown?: CostBreakdown | null;
  cost_usd?: number | null;
  source_content_id?: string | null;
  stop_requested_at?: string | null;
  cost_confirmed_at?: string | null;
}

function StepRow({ step }: { step: Step }) {
  const Icon =
    step.status === "done"
      ? CheckCircle2
      : step.status === "running"
        ? Loader2
        : Circle;
  const color =
    step.status === "done"
      ? "text-emerald-600"
      : step.status === "running"
        ? "text-primary"
        : step.status === "error"
          ? "text-destructive"
          : "text-muted-foreground";
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
      <Icon className={`h-4 w-4 flex-shrink-0 ${color} ${step.status === "running" ? "animate-spin" : ""}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-body ${step.status === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
          {step.label}
        </p>
      </div>
      {step.detail && (
        <span className="text-xs font-body text-muted-foreground flex-shrink-0">{step.detail}</span>
      )}
    </div>
  );
}

function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs.toString().padStart(2, "0")}s`;
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function TimelineRow({ step, now, isLast }: { step: Step; now: number; isLast: boolean }) {
  const started = step.started_at ? new Date(step.started_at).getTime() : null;
  const ended = step.ended_at ? new Date(step.ended_at).getTime() : null;
  const elapsed =
    started === null
      ? null
      : step.status === "done" && ended
        ? ended - started
        : step.status === "running"
          ? now - started
          : null;
  const dotColor =
    step.status === "done"
      ? "bg-emerald-600"
      : step.status === "running"
        ? "bg-primary animate-pulse"
        : step.status === "error"
          ? "bg-destructive"
          : "bg-muted-foreground/40";
  return (
    <div className="relative pl-6 pb-4 last:pb-0">
      <span className={`absolute left-[3px] top-2 h-2.5 w-2.5 rounded-full ring-2 ring-background z-10 ${dotColor}`} />
      {!isLast && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-body text-foreground">{step.label}</p>
        <span className="text-xs font-body text-muted-foreground tabular-nums flex-shrink-0">
          {elapsed !== null ? formatElapsed(elapsed) : "—"}
        </span>
      </div>
      <p className="text-xs font-body text-muted-foreground mt-0.5">
        started {formatTime(step.started_at)}
        {step.detail ? ` · ${step.detail}` : ""}
        {" · "}
        <span className="capitalize">{step.status}</span>
      </p>
    </div>
  );
}

interface SourceOption {
  id: string;
  plant_name: string;
  created_at: string;
  stills: string[];
}

export default function Animated() {
  const [row, setRow] = useState<AnimatedRow | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const { toast } = useToast();
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load most recent row (any status) so the UI can show its state.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("botanical_animated")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data[0]) setRow(data[0] as unknown as AnimatedRow);
    })();
  }, []);

  const loadSources = async () => {
    const { data } = await supabase
      .from("botanical_content")
      .select("id, plant_name, created_at, script_visuals")
      .order("created_at", { ascending: false })
      .limit(30);
    if (!data) return;
    const MOMENTS = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"];
    const opts: SourceOption[] = [];
    for (const item of data) {
      let visuals: Array<{ moment: string; image_url?: string | null; status?: string }> = [];
      try {
        visuals = typeof item.script_visuals === "string"
          ? JSON.parse(item.script_visuals)
          : (item.script_visuals as typeof visuals);
      } catch { continue; }
      if (!Array.isArray(visuals)) continue;
      const stills = MOMENTS.map((m) => visuals.find((v) => v.moment === m)?.image_url ?? "");
      if (stills.some((u) => !u)) continue;
      opts.push({
        id: item.id,
        plant_name: item.plant_name ?? "Unknown",
        created_at: item.created_at,
        stills,
      });
      if (opts.length >= 12) break;
    }
    setSources(opts);
  };

  useEffect(() => {
    if (pickerOpen && sources.length === 0) loadSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  useEffect(() => {
    if (!row?.id) return;
    const channel = supabase
      .channel(`animated:${row.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "botanical_animated", filter: `id=eq.${row.id}` },
        (payload) => {
          setRow(payload.new as AnimatedRow);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [row?.id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const start = async (sourceContentId?: string | null) => {
    setIsStarting(true);
    try {
      const { data, error } = await invokeFn("animated-start", {
        body: sourceContentId ? { source_content_id: sourceContentId } : {},
      });
      if (error) {
        // Parse 409 conflict → focus the returned active run.
        const parsed = await readFnError(error);
        const body = parsed.body as { error?: string; active_run?: { id: string; plant_name?: string; queue_status?: string } } | null;
        if (parsed.status === 409 && body?.error === "active_run_exists" && body?.active_run?.id) {
          const { data: full } = await supabase
            .from("botanical_animated").select("*").eq("id", body.active_run.id).single();
          setRow(full as unknown as AnimatedRow);
          toast({
            title: "Another run is active",
            description: `Focused the existing run (${body.active_run.plant_name ?? body.active_run.queue_status}). Stop it first to start a new one.`,
          });
          return;
        }
        throw new Error(body?.error || error.message);
      }
      if (!data?.success) throw new Error(data?.error || "Failed to start");
      const { data: full } = await supabase
        .from("botanical_animated")
        .select("*")
        .eq("id", data.row_id)
        .single();
      setRow(full as unknown as AnimatedRow);
      setPickerOpen(false);
      setSelectedSourceId(null);
      toast({
        title: sourceContentId ? "Preparing selected stills" : "Preparing fresh stills",
        description: "You'll be asked to review the animation cost before any paid provider jobs run.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Failed to start", description: msg, variant: "destructive" });
    } finally {
      setIsStarting(false);
    }
  };

  const stopRun = async () => {
    if (!row?.id) return;
    setIsStopping(true);
    try {
      const { data, error } = await invokeFn("animated-stop", { body: { row_id: row.id } });
      if (error) throw new Error(error.message);
      const summary = data as { canceled?: unknown[]; already_finished?: unknown[]; failed_to_cancel?: unknown[] };
      toast({
        title: "Stop requested",
        description:
          `Canceled ${summary?.canceled?.length ?? 0} · already finished ${summary?.already_finished?.length ?? 0}` +
          ((summary?.failed_to_cancel?.length ?? 0) > 0 ? ` · ${summary!.failed_to_cancel!.length} could not cancel` : ""),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Stop failed", description: msg, variant: "destructive" });
    } finally {
      setIsStopping(false);
    }
  };

  const retryStitch = async () => {
    if (!row?.id) return;
    const { data, error } = await invokeFn("animated-stitch", { body: { row_id: row.id } });
    if (error || !data?.success) {
      toast({ title: "Retry failed", description: error?.message || data?.error || "Unknown", variant: "destructive" });
    } else {
      toast({ title: "Stitch restarted", description: "Server is re-assembling the video." });
    }
  };

  const retryStills = async () => {
    if (!row?.id) return;
    const { data, error } = await invokeFn("animated-start-resume", {
      body: { row_id: row.id, manual: true },
    });
    if (error) {
      toast({ title: "Retry failed", description: error.message, variant: "destructive" });
    } else if (!data?.success) {
      toast({
        title: "Retry unavailable",
        description: data?.error === "retry_budget_exhausted"
          ? `Manual retry budget exhausted (${data.used}/${data.limit}).`
          : (data?.error || "Unknown"),
        variant: "destructive",
      });
    } else {
      toast({ title: "Retrying stuck stills", description: "Bounded polling window opened." });
    }
  };

  const steps = useMemo<Step[]>(() => {
    return (
      row?.progress?.steps ?? [
        { key: "script", label: "Picking plant + writing script", status: "pending" },
        { key: "stills", label: "Preparing 6 hero stills", status: "pending" },
        { key: "clips", label: "Choose one hero still and motion prompt", status: "pending" },
        { key: "save", label: "Save or send the approved clip", status: "pending" },
      ]
    );
  }, [row]);

  const isRunning =
    row?.queue_status === "generating" ||
    row?.queue_status === "stills_ready" ||
    row?.queue_status === "animating" ||
    row?.queue_status === "stitching";

  const stillsStep = steps.find((s) => s.key === "stills");
  const stillsCount = (() => {
    const m = stillsStep?.detail?.match(/^(\d+)\s*\/\s*6$/);
    return m ? parseInt(m[1], 10) : 0;
  })();
  const stillsStuck =
    row?.queue_status === "generating" &&
    stillsStep?.status === "running" &&
    stillsCount < 6 &&
    row?.updated_at &&
    now - new Date(row.updated_at).getTime() > 2 * 60 * 1000;

  const stitchStuck =
    row?.queue_status === "stitching" &&
    row?.updated_at &&
    now - new Date(row.updated_at).getTime() > 5 * 60 * 1000;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Animated Video"
        subtitle="Prepare six stills, then animate one reviewed hero clip"
        contained
      />

      <main className="container py-8 max-w-2xl space-y-6 pb-28 md:pb-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-serif text-lg text-foreground">
                {row?.plant_name || "Ready to prepare stills"}
              </h2>
              {row?.verified_fact && (
                <p className="text-sm text-muted-foreground font-body mt-1">{row.verified_fact}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                size="lg"
                disabled={isStarting}
                onClick={() => setPickerOpen((v) => !v)}
              >
                {pickerOpen ? "Close picker" : "Choose source"}
              </Button>
              {isRunning && (
                <Button variant="destructive" size="lg" onClick={stopRun} disabled={isStopping}>
                  {isStopping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <StopCircle className="h-4 w-4 mr-2" />}
                  {isStopping ? "Stopping…" : "Stop run & cancel provider jobs"}
                </Button>
              )}
              <Button onClick={() => start()} disabled={isStarting || isRunning} size="lg">
                {isStarting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {isStarting ? "Starting…" : "Prepare fresh stills"}
              </Button>
            </div>
          </div>

          {isRunning && (
            <p className="text-xs text-muted-foreground font-body mb-3">
              Stopping marks this run canceled on the server and attempts to cancel every non-terminal provider prediction.
              Clips that already succeeded remain billable.
            </p>
          )}

          {pickerOpen && (
            <div className="rounded-md border border-border/60 bg-background/50 p-3 mb-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-body">
                Pick an existing generation to animate
              </p>
              {sources.length === 0 ? (
                <p className="text-sm text-muted-foreground font-body py-4 text-center">Loading recent content…</p>
              ) : (
                <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
                  {sources.map((s) => {
                    const selected = selectedSourceId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSourceId(selected ? null : s.id)}
                        className={`w-full flex items-center gap-3 p-2 rounded-md border text-left transition-colors ${
                          selected ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex gap-0.5 flex-shrink-0">
                          {s.stills.slice(0, 6).map((u, i) => (
                            <img key={i} src={u} alt="" className="w-6 h-10 object-cover rounded-sm border border-border/40" />
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body text-foreground truncate">{s.plant_name}</p>
                          <p className="text-xs text-muted-foreground font-body">
                            {new Date(s.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={!selectedSourceId || isStarting || isRunning}
                  onClick={() => selectedSourceId && start(selectedSourceId)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Prepare selected stills
                </Button>
              </div>
            </div>
          )}

          {row && (
            <div className="rounded-md border border-border/60 bg-background/50 p-3 mb-4">
              {steps.map((s) => (
                <StepRow key={s.key} step={s} />
              ))}
              {(row.cost_usd != null || row.cost_breakdown) && (
                <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-xs font-body text-muted-foreground">
                  <span>
                    Estimated cost
                    {row.cost_breakdown && (
                      <span className="ml-2 text-muted-foreground/70">
                        {row.cost_breakdown.stills ? `stills $${row.cost_breakdown.stills.total_usd.toFixed(2)}` : ""}
                        {row.cost_breakdown.clips ? ` · clips $${row.cost_breakdown.clips.total_usd.toFixed(2)}` : ""}
                        {row.cost_breakdown.stitch ? ` · stitch $${row.cost_breakdown.stitch.total_usd.toFixed(2)}` : ""}
                      </span>
                    )}
                  </span>
                  <span className="text-foreground font-medium">
                    ${(row.cost_usd ?? 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {row && steps.some((s) => s.started_at) && (
            <div className="rounded-md border border-border/60 bg-background/50 p-4 mb-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-body mb-3">
                Progress timeline
              </p>
              <div>
                {steps.map((s, i) => (
                  <TimelineRow key={s.key} step={s} now={now} isLast={i === steps.length - 1} />
                ))}
              </div>
            </div>
          )}

          {stillsStuck && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-foreground font-body">
                Stills have been stalled &gt;2 minutes ({stillsCount} / 6). Manual retry is bounded — the server limits attempts per run.
              </p>
              <Button variant="outline" size="sm" onClick={retryStills}>
                <RotateCw className="h-4 w-4 mr-2" /> Retry stuck stills
              </Button>
            </div>
          )}

          {stitchStuck && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-foreground font-body">
                Stitch has been running &gt;5 minutes. You can retry the final step.
              </p>
              <Button variant="outline" size="sm" onClick={retryStitch}>
                <RotateCw className="h-4 w-4 mr-2" /> Retry stitch
              </Button>
            </div>
          )}

          {row?.error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive font-body">
              {row.error}
            </div>
          )}

          {row?.still_urls && row.still_urls.some(Boolean) && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-body mb-2">Hero stills</p>
              <div className="grid grid-cols-6 gap-1.5">
                {row.still_urls.map((u, i) =>
                  u ? (
                    <img key={i} src={u} alt={`still ${i + 1}`} className="aspect-[9/16] object-cover rounded-sm border border-border/40" />
                  ) : (
                    <div key={i} className="aspect-[9/16] rounded-sm border border-dashed border-border/40 bg-muted/30" />
                  ),
                )}
              </div>
            </div>
          )}

          {row?.still_urls && row.still_urls.filter(Boolean).length === 6 && (
            <AnimationPromptLab
              animationRowId={row.id}
              plantName={row.plant_name}
              stillUrls={row.still_urls}
            />
          )}

          {row?.clip_urls && row.clip_urls.some(Boolean) && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-body mb-2">Animated clips</p>
              <div className="grid grid-cols-3 gap-2">
                {row.clip_urls.map((u, i) =>
                  u ? (
                    <video key={i} src={u} muted playsInline controls className="aspect-[9/16] object-cover rounded-sm border border-border/40 w-full" />
                  ) : (
                    <div key={i} className="aspect-[9/16] rounded-sm border border-dashed border-border/40 bg-muted/30 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {row?.final_video_url && (
            <div className="mt-6 space-y-3">
              <p className="text-[10px] uppercase tracking-wide text-primary font-body">Final video</p>
              <video src={row.final_video_url} controls playsInline className="w-full rounded-md border border-border" />
              <div className="flex gap-2">
                <a href={row.final_video_url} download={`${row.plant_name ?? "video"}.mp4`}>
                  <Button variant="default" size="sm">
                    <Download className="h-4 w-4 mr-2" /> Download MP4
                  </Button>
                </a>
                <a href={row.final_video_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <Play className="h-4 w-4 mr-2" /> Open
                  </Button>
                </a>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground font-body text-center">
          Stills are prepared before paid animation. Prompt Lab submits one reviewed clip and never starts the legacy six-clip pipeline.
        </p>
      </main>

    </div>
  );
}
