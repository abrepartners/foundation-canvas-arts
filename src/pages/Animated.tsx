import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

export default function Animated() {
  const [row, setRow] = useState<AnimatedRow | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const animateTriggered = useRef<string | null>(null);
  const { toast } = useToast();

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
    const t = setInterval(() => setNow(Date.now()), 30000);
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

  const start = async () => {
    setIsStarting(true);
    animateTriggered.current = null;
    try {
      const { data, error } = await supabase.functions.invoke("animated-start");
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to start");
      const { data: full } = await supabase
        .from("botanical_animated")
        .select("*")
        .eq("id", data.row_id)
        .single();
      setRow(full as unknown as AnimatedRow);
      toast({
        title: "Generating animated video",
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

  const stitchStuck =
    row?.queue_status === "stitching" &&
    row?.updated_at &&
    now - new Date(row.updated_at).getTime() > 5 * 60 * 1000;

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
