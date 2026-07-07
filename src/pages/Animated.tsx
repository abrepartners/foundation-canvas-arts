import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, Loader2, Play, Download, Sparkles, RotateCw } from "lucide-react";

interface Step {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  started_at?: string;
  ended_at?: string;
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
  const [now, setNow] = useState<number>(Date.now());
  const animateTriggered = useRef<string | null>(null);
  const { toast } = useToast();
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Auto-resume: on mount, load the most recent unfinished row (or most recent done row to display).
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

  // Load recent botanical_content rows that have all 6 stills done.
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
      } catch {
        continue;
      }
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
  }, [pickerOpen]);

  // Subscribe to row updates.
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

  // Tick once a minute for "stuck" detection.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-trigger animation step once stills are ready.
  useEffect(() => {
    if (!row?.id) return;
    if (row.queue_status !== "stills_ready") return;
    if (animateTriggered.current === row.id) return;
    animateTriggered.current = row.id;
    supabase.functions
      .invoke("animated-animate-all", { body: { row_id: row.id } })
      .then(({ data, error }) => {
        if (error || !data?.success) {
          toast({
            title: "Animation start failed",
            description: error?.message || data?.error || "Unknown",
            variant: "destructive",
          });
        }
      });
  }, [row?.id, row?.queue_status, toast]);

  const start = async (sourceContentId?: string | null) => {
    setIsStarting(true);
    animateTriggered.current = null;
    try {
      const { data, error } = await supabase.functions.invoke("animated-start", {
        body: sourceContentId ? { source_content_id: sourceContentId } : {},
      });
      if (error) throw new Error(error.message);
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
        title: sourceContentId ? "Animating existing content" : "Generating animated video",
        description: "Runs entirely on our servers — feel free to close the tab.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Failed to start", description: msg, variant: "destructive" });
    } finally {
      setIsStarting(false);
    }
  };


  const retryStitch = async () => {
    if (!row?.id) return;
    const { data, error } = await supabase.functions.invoke("animated-stitch", {
      body: { row_id: row.id },
    });
    if (error || !data?.success) {
      toast({
        title: "Retry failed",
        description: error?.message || data?.error || "Unknown",
        variant: "destructive",
      });
    } else {
      toast({ title: "Stitch restarted", description: "Server is re-assembling the video." });
    }
  };

  const retryStills = async () => {
    if (!row?.id) return;
    const sourceId = (row as unknown as { source_content_id?: string }).source_content_id;
    if (!sourceId) {
      toast({ title: "Cannot retry", description: "Missing source content id.", variant: "destructive" });
      return;
    }
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.functions.invoke("generate-botanical-resume", {
        body: { content_id: sourceId, image_provider: "openai" },
      }),
      supabase.functions.invoke("animated-start-resume", { body: { row_id: row.id } }),
    ]);
    if (e1 || e2) {
      toast({
        title: "Retry failed",
        description: e1?.message || e2?.message || "Unknown",
        variant: "destructive",
      });
    } else {
      toast({ title: "Retrying stuck stills", description: "Resuming image generation." });
    }
  };

  const steps = useMemo<Step[]>(() => {
    return (
      row?.progress?.steps ?? [
        { key: "script", label: "Picking plant + writing script", status: "pending" },
        { key: "stills", label: "Designing 6 hero stills (OpenAI gpt-image-2)", status: "pending" },
        { key: "clips", label: "Animating 6 clips (Kling v2.1, 10s each)", status: "pending" },
        { key: "stitch", label: "Stitching final 60s video", status: "pending" },
        { key: "save", label: "Saving to library", status: "pending" },
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
        subtitle="One click. 60-second silent vertical MP4. Fully automatic."
        contained
      />

      <main className="container py-8 max-w-2xl space-y-6 pb-28 md:pb-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-serif text-lg text-foreground">
                {row?.plant_name || "Ready to generate"}
              </h2>
              {row?.verified_fact && (
                <p className="text-sm text-muted-foreground font-body mt-1">{row.verified_fact}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="lg"
                disabled={isStarting || isRunning}
                onClick={() => setPickerOpen((v) => !v)}
              >
                {pickerOpen ? "Close picker" : "Choose source"}
              </Button>
              <Button onClick={() => start()} disabled={isStarting || isRunning} size="lg">
                {isStarting || isRunning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {isRunning ? "Generating…" : "Generate fresh"}
              </Button>
            </div>
          </div>

          {pickerOpen && (
            <div className="rounded-md border border-border/60 bg-background/50 p-3 mb-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-body">
                Pick an existing generation to animate
              </p>
              {sources.length === 0 ? (
                <p className="text-sm text-muted-foreground font-body py-4 text-center">
                  Loading recent content…
                </p>
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
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border/60 hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex gap-0.5 flex-shrink-0">
                          {s.stills.slice(0, 6).map((u, i) => (
                            <img
                              key={i}
                              src={u}
                              alt=""
                              className="w-6 h-10 object-cover rounded-sm border border-border/40"
                            />
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body text-foreground truncate">{s.plant_name}</p>
                          <p className="text-xs text-muted-foreground font-body">
                            {new Date(s.created_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
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
                  Animate this one
                </Button>
              </div>
            </div>
          )}


          {row && (
            <div className="rounded-md border border-border/60 bg-background/50 p-3 mb-4">
              {steps.map((s) => (
                <StepRow key={s.key} step={s} />
              ))}
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
                Stills have been stalled &gt;2 minutes ({stillsCount} / 6). You can retry the stuck images.
              </p>
              <Button variant="outline" size="sm" onClick={retryStills}>
                <RotateCw className="h-4 w-4 mr-2" /> Retry stills
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
          Runs entirely on our servers. Close the tab anytime — your video will be waiting when you come back.
        </p>
      </main>
    </div>
  );
}
