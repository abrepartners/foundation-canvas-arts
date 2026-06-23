import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, Loader2, Play, Download, Sparkles } from "lucide-react";
import { stitchClips } from "@/lib/stitchClips";

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
}

function StepRow({ step }: { step: Step }) {
  const Icon =
    step.status === "done"
      ? CheckCircle2
      : step.status === "running"
        ? Loader2
        : step.status === "error"
          ? Circle
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

export default function Animated() {
  const [row, setRow] = useState<AnimatedRow | null>(null);
  const [stitchProgress, setStitchProgress] = useState<number>(0);
  const [isStarting, setIsStarting] = useState(false);
  const stitchTriggered = useRef<string | null>(null);
  const animateTriggered = useRef<string | null>(null);
  const { toast } = useToast();

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

  // Auto-trigger client stitch once clips are done.
  useEffect(() => {
    if (!row?.id) return;
    if (row.queue_status !== "clips_done") return;
    if (stitchTriggered.current === row.id) return;
    if (!row.clip_urls || row.clip_urls.length !== 6 || row.clip_urls.some((u) => !u)) return;
    stitchTriggered.current = row.id;

    (async () => {
      try {
        // Update steps locally to show stitch running.
        setRow((prev) =>
          prev
            ? {
                ...prev,
                progress: {
                  stage: "stitch",
                  steps: (prev.progress?.steps ?? []).map((s) =>
                    s.key === "stitch" ? { ...s, status: "running", detail: "0%" } : s,
                  ),
                },
              }
            : prev,
        );

        const blob = await stitchClips(row.clip_urls!, (p) => {
          setStitchProgress(p);
          setRow((prev) =>
            prev
              ? {
                  ...prev,
                  progress: {
                    stage: "stitch",
                    steps: (prev.progress?.steps ?? []).map((s) =>
                      s.key === "stitch" ? { ...s, status: "running", detail: `${Math.round(p * 100)}%` } : s,
                    ),
                  },
                }
              : prev,
          );
        });

        // Mark save running.
        setRow((prev) =>
          prev
            ? {
                ...prev,
                progress: {
                  stage: "save",
                  steps: (prev.progress?.steps ?? []).map((s) => {
                    if (s.key === "stitch") return { ...s, status: "done", detail: "100%" };
                    if (s.key === "save") return { ...s, status: "running" };
                    return s;
                  }),
                },
              }
            : prev,
        );

        // Upload via finalize edge function.
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/animated-finalize?row_id=${row.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "video/mp4", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
            body: blob,
          },
        );
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Finalize failed");
        toast({ title: "Animated video ready", description: "Your 60s video is saved." });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({ title: "Stitch failed", description: msg, variant: "destructive" });
        // Mark error on row.
        await supabase
          .from("botanical_animated")
          .update({ queue_status: "error", error: `stitch: ${msg}` })
          .eq("id", row.id);
      }
    })();
  }, [row, toast]);

  const start = async () => {
    setIsStarting(true);
    stitchTriggered.current = null;
    animateTriggered.current = null;
    setStitchProgress(0);
    try {
      const { data, error } = await supabase.functions.invoke("animated-start");
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to start");
      // Fetch the new row.
      const { data: full } = await supabase
        .from("botanical_animated")
        .select("*")
        .eq("id", data.row_id)
        .single();
      setRow(full as unknown as AnimatedRow);
      toast({ title: "Generating animated video", description: "This takes ~10–15 minutes. Live progress below." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Failed to start", description: msg, variant: "destructive" });
    } finally {
      setIsStarting(false);
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
    row?.queue_status === "clips_done";

  void stitchProgress;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex items-center gap-3 py-4">
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-serif text-foreground tracking-tight">Animated Video</h1>
            <p className="text-muted-foreground font-body text-xs">
              One click. 60-second silent vertical MP4. Fully automatic.
            </p>
          </div>
          <nav className="flex items-center gap-1 text-sm font-body">
            <Link to="/" className="px-3 py-1.5 rounded-md hover:bg-secondary text-muted-foreground">Plants</Link>
            <Link to="/trends" className="px-3 py-1.5 rounded-md hover:bg-secondary text-muted-foreground">Trends</Link>
            <Link to="/animated" className="px-3 py-1.5 rounded-md bg-secondary text-foreground">Animated</Link>
            <Link to="/queue" className="px-3 py-1.5 rounded-md hover:bg-secondary text-muted-foreground">Queue</Link>
          </nav>
        </div>
      </header>

      <main className="container py-8 max-w-2xl space-y-6">
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
            <Button onClick={start} disabled={isStarting || isRunning} size="lg">
              {isStarting || isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {isRunning ? "Generating…" : "Generate Animated Video"}
            </Button>
          </div>

          {row && (
            <div className="rounded-md border border-border/60 bg-background/50 p-3 mb-4">
              {steps.map((s) => (
                <StepRow key={s.key} step={s} />
              ))}
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
          Pipeline: Replicate openai/gpt-image-2 (stills) → Replicate kwaivgi/kling-v2.1 (animation) → ffmpeg.wasm
          (stitch in your browser). Total wall time ~10–15 minutes.
        </p>
      </main>
    </div>
  );
}
