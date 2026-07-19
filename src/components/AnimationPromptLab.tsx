import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FlaskConical, Loader2, Play, Sparkles, StopCircle, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { invokeFn, readFnError } from "@/lib/invokeFn";

type ArchetypeKey = "growth_reveal" | "living_specimen" | "archival_evidence";
type ModelKey = "seedance_1_5_pro" | "seedance_2_mini" | "kling_standard";

interface LabOptions {
  pricing_version: string;
  prompt_version: string;
  duration_seconds: number;
  start_frame: { model: string; cost_usd: number };
  models: Array<{
    key: ModelKey;
    label: string;
    model: string;
    resolution: string;
    cost_per_second_usd: number;
    supports_last_frame: boolean;
    five_second_cost_usd: number;
    note: string;
  }>;
  archetypes: Array<{
    key: ArchetypeKey;
    label: string;
    description: string;
  }>;
}

interface LabJob {
  id: string;
  animation_row_id: string;
  still_index: number;
  still_url: string;
  archetype: ArchetypeKey;
  model_key: ModelKey;
  model: string;
  duration_seconds: number;
  resolution: string;
  prompt_version: string;
  prompt: string;
  status: "queued" | "preparing_start_frame" | "submitting_video" | "running" | "succeeded" | "failed" | "canceled";
  provider_status: string | null;
  estimated_cost_usd: number;
  pricing_version: string;
  start_frame_url: string | null;
  output_url: string | null;
  stop_requested_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface Props {
  animationRowId: string;
  plantName: string | null;
  stillUrls: string[];
}

const ACTIVE = new Set(["queued", "preparing_start_frame", "submitting_video", "running"]);

function statusLabel(job: LabJob): string {
  if (job.status === "queued") return "Queued safely";
  if (job.status === "preparing_start_frame") return "Preparing matched seed-stage frame";
  if (job.status === "submitting_video") return "Submitting one video";
  if (job.status === "running") return "Generating one video";
  if (job.status === "succeeded") return "Test complete";
  if (job.status === "canceled") return "Test stopped";
  return "Test failed";
}

export function AnimationPromptLab({ animationRowId, plantName, stillUrls }: Props) {
  const [options, setOptions] = useState<LabOptions | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [selectedStill, setSelectedStill] = useState(0);
  const [archetype, setArchetype] = useState<ArchetypeKey>("growth_reveal");
  const [modelKey, setModelKey] = useState<ModelKey>("seedance_1_5_pro");
  const [job, setJob] = useState<LabJob | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isUploadingYoutube, setIsUploadingYoutube] = useState(false);
  const requestKey = useRef<string | null>(null);
  const youtubeKey = useRef<string | null>(null);
  const { toast } = useToast();

  const loadOptions = async () => {
    const { data, error } = await invokeFn<LabOptions>("animated-prompt-lab", { body: { action: "options" } });
    if (error) throw new Error(error.message);
    if (data) {
      setOptions(data);
      setBackendAvailable(true);
    }
  };

  const loadLatest = async () => {
    const { data, error } = await invokeFn<{ job: LabJob | null }>("animated-prompt-lab", {
      body: { action: "status", animation_row_id: animationRowId },
    });
    if (!error) setJob(data?.job ?? null);
  };

  useEffect(() => {
    setSelectedStill(0);
    setJob(null);
    setBackendAvailable(null);
    requestKey.current = null;
    loadOptions().catch((error) => {
      setBackendAvailable(false);
      console.warn("Prompt Lab backend unavailable", error);
    });
    loadLatest().catch((error) => console.warn("Prompt Lab status failed", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationRowId]);

  useEffect(() => {
    if (!job || !ACTIVE.has(job.status)) return;
    const timer = window.setInterval(() => {
      invokeFn<{ job: LabJob | null }>("animated-prompt-lab", {
        body: { action: "status", job_id: job.id },
      }).then(({ data, error }) => {
        if (!error && data?.job) setJob(data.job);
      });
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [job]);

  const model = options?.models.find((item) => item.key === modelKey) ?? null;
  const archetypeOption = options?.archetypes.find((item) => item.key === archetype) ?? null;
  const quote = useMemo(() => {
    if (!options || !model) return null;
    const video = model.cost_per_second_usd * options.duration_seconds;
    const start = archetype === "growth_reveal" ? options.start_frame.cost_usd : 0;
    return {
      video,
      start,
      total: Math.round((video + start) * 10_000) / 10_000,
    };
  }, [archetype, model, options]);

  const active = !!job && ACTIVE.has(job.status);

  // New Edge Functions can arrive after the frontend in Lovable deployments.
  // Keep the lab fully hidden until its protected options contract responds,
  // so production never exposes a dead or partially wired paid control.
  if (backendAvailable !== true || !options) return null;

  const openConfirmation = () => {
    requestKey.current = crypto.randomUUID();
    setConfirmOpen(true);
  };

  const startTest = async () => {
    if (!options || !quote || !requestKey.current) return;
    setIsStarting(true);
    try {
      const { data, error } = await invokeFn<{ success?: boolean; job?: LabJob }>("animated-prompt-lab", {
        body: {
          action: "start",
          animation_row_id: animationRowId,
          still_index: selectedStill,
          archetype,
          model_key: modelKey,
          idempotency_key: requestKey.current,
          confirmed_estimate_usd: quote.total,
          pricing_version: options.pricing_version,
        },
      });
      if (error) {
        const parsed = await readFnError(error);
        const response = parsed.body as {
          error?: string;
          active_job?: LabJob;
          expected_total_usd?: number;
        } | null;
        if (parsed.status === 409 && response?.active_job) {
          setJob(response.active_job);
          throw new Error("Another Prompt Lab test is already active. It is shown below.");
        }
        if (parsed.status === 402) {
          await loadOptions();
          throw new Error(`Pricing changed to $${Number(response?.expected_total_usd ?? 0).toFixed(2)}. Review and confirm again.`);
        }
        throw new Error(response?.error || error.message);
      }
      if (!data?.job) throw new Error("The server did not return the Prompt Lab job.");
      setJob(data.job);
      setConfirmOpen(false);
      toast({
        title: "One animation test started",
        description: `No automatic retries. Maximum confirmed estimate: $${quote.total.toFixed(2)}.`,
      });
    } catch (error) {
      toast({
        title: "Prompt Lab could not start",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const stopTest = async () => {
    if (!job) return;
    setIsStopping(true);
    try {
      const { data, error } = await invokeFn<{
        job?: LabJob;
        canceled?: string[];
        failed_to_cancel?: unknown[];
      }>("animated-prompt-lab", { body: { action: "stop", job_id: job.id } });
      if (error) throw new Error(error.message);
      if (data?.job) setJob(data.job);
      toast({
        title: "Prompt Lab stopped",
        description: `Future stages blocked. Provider cancellations: ${data?.canceled?.length ?? 0}` +
          ((data?.failed_to_cancel?.length ?? 0) ? `; ${data!.failed_to_cancel!.length} could not be confirmed` : ""),
      });
    } catch (error) {
      toast({ title: "Stop failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setIsStopping(false);
    }
  };

  const sendToYouTube = async () => {
    if (!job?.output_url) return;
    if (!youtubeKey.current) youtubeKey.current = crypto.randomUUID();
    setIsUploadingYoutube(true);
    try {
      const { data, error } = await invokeFn<{ publication?: { remote_url?: string } }>("youtube-upload", {
        body: {
          prompt_lab_job_id: job.id,
          idempotency_key: youtubeKey.current,
          title: `${plantName ?? "Botanical discovery"} #Shorts`,
        },
      });
      if (error) throw new Error(error.message);
      toast({
        title: "Sent to YouTube privately",
        description: "Review it in YouTube Studio, add final details, then publish it yourself.",
      });
      if (data?.publication?.remote_url) window.open(data.publication.remote_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({ title: "YouTube upload failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setIsUploadingYoutube(false);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-primary/25 bg-primary/[0.035] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <h3 className="font-serif text-lg text-foreground">Animation Prompt Lab</h3>
          </div>
          <p className="text-xs text-muted-foreground font-body mt-1">
            Test one still, one prompt, and one paid video. This never launches the six-clip pipeline.
          </p>
        </div>
        {active && (
          <Button variant="destructive" size="sm" onClick={stopTest} disabled={isStopping}>
            {isStopping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <StopCircle className="h-4 w-4 mr-2" />}
            Stop test
          </Button>
        )}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-body mb-2">1. Select one still</p>
        <div className="grid grid-cols-6 gap-1.5">
          {stillUrls.slice(0, 6).map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => setSelectedStill(index)}
              disabled={active}
              aria-label={`Select still ${index + 1}`}
              className={`relative rounded-sm border-2 overflow-hidden transition-colors ${
                selectedStill === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={url} alt={`Prompt Lab still ${index + 1}`} className="aspect-[9/16] object-cover w-full" />
              <span className="absolute left-1 bottom-1 rounded bg-background/85 px-1 text-[9px] font-body">{index + 1}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-body mb-2">2. Choose motion</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {options?.archetypes.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={active}
              onClick={() => {
                setArchetype(item.key);
                if (item.key === "growth_reveal" && modelKey === "kling_standard") setModelKey("seedance_1_5_pro");
              }}
              className={`rounded-md border p-3 text-left transition-colors ${
                archetype === item.key ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <span className="text-sm font-medium font-body text-foreground">{item.label}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground font-body mt-1">{item.description}</span>
            </button>
          )) ?? <div className="text-sm text-muted-foreground">Loading motion prompts…</div>}
        </div>
      </div>

      <div>
        <label htmlFor="prompt-lab-model" className="text-[10px] uppercase tracking-wide text-muted-foreground font-body">
          3. Choose model
        </label>
        <select
          id="prompt-lab-model"
          value={modelKey}
          disabled={active || !options}
          onChange={(event) => setModelKey(event.target.value as ModelKey)}
          className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-body text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {options?.models.map((item) => (
            <option key={item.key} value={item.key} disabled={archetype === "growth_reveal" && !item.supports_last_frame}>
              {item.label} · ${item.five_second_cost_usd.toFixed(2)} / 5s
            </option>
          ))}
        </select>
        {model && <p className="text-xs text-muted-foreground font-body mt-1">{model.note}</p>}
      </div>

      <div className="rounded-md border border-border bg-background/75 p-3 text-sm font-body">
        <div className="flex justify-between gap-3">
          <span>{options?.duration_seconds ?? 5}s {model?.label ?? "video"}, 720p, audio off</span>
          <span className="tabular-nums">${quote?.video.toFixed(2) ?? "—"}</span>
        </div>
        {archetype === "growth_reveal" && (
          <div className="flex justify-between gap-3 text-muted-foreground">
            <span>Matched seed-stage start frame</span>
            <span className="tabular-nums">${quote?.start.toFixed(2) ?? "—"}</span>
          </div>
        )}
        <div className="flex justify-between gap-3 border-t border-border mt-2 pt-2 font-medium">
          <span>Maximum confirmed estimate</span>
          <span className="tabular-nums">${quote?.total.toFixed(2) ?? "—"}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          One attempt only. Failed jobs do not retry automatically. Provider billing can still apply after submission.
        </p>
      </div>

      <Button className="w-full" onClick={openConfirmation} disabled={active || !quote || !stillUrls[selectedStill]}>
        <Sparkles className="h-4 w-4 mr-2" />
        {quote ? `Review cost and run one test ($${quote.total.toFixed(2)})` : "Loading current pricing…"}
      </Button>

      {job && (
        <div className={`rounded-md border p-3 space-y-3 ${job.status === "failed" ? "border-destructive/50 bg-destructive/5" : "border-border bg-background/75"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium font-body text-foreground">{statusLabel(job)}</p>
              <p className="text-xs text-muted-foreground font-body">
                Still {job.still_index + 1} · {options?.archetypes.find((item) => item.key === job.archetype)?.label ?? job.archetype} · {options?.models.find((item) => item.key === job.model_key)?.label ?? job.model_key}
              </p>
            </div>
            {active && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
          </div>
          {job.error && <p className="text-xs text-destructive font-body">{job.error}</p>}
          {job.start_frame_url && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-body mb-1">Generated start frame</p>
              <img src={job.start_frame_url} alt="Generated seed-stage start frame" className="w-28 aspect-[9/16] object-cover rounded border border-border" />
            </div>
          )}
          {job.output_url && (
            <div className="space-y-2">
              <video src={job.output_url} controls playsInline className="w-full rounded-md border border-border" />
              <div className="flex gap-2">
                <a href={job.output_url} download={`${plantName ?? "botanical"}-prompt-lab.mp4`}>
                  <Button size="sm"><Download className="h-4 w-4 mr-2" />Download</Button>
                </a>
                <a href={job.output_url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline"><Play className="h-4 w-4 mr-2" />Open</Button>
                </a>
                <Button size="sm" variant="outline" onClick={sendToYouTube} disabled={isUploadingYoutube}>
                  {isUploadingYoutube ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Youtube className="h-4 w-4 mr-2" />}
                  Send private to YouTube
                </Button>
              </div>
            </div>
          )}
          <details className="text-xs font-body">
            <summary className="cursor-pointer text-muted-foreground">Exact prompt and audit details</summary>
            <p className="mt-2 whitespace-pre-wrap text-foreground">{job.prompt}</p>
            <p className="mt-2 text-muted-foreground">
              Confirmed ${job.estimated_cost_usd.toFixed(2)} · {job.duration_seconds}s · {job.resolution} · pricing {job.pricing_version} · prompt {job.prompt_version}
            </p>
          </details>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run one paid Prompt Lab test?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  This submits exactly one {options?.duration_seconds ?? 5}-second video for still {selectedStill + 1}. It does not start the six-clip production pipeline.
                </p>
                <div className="rounded-md border border-border bg-muted/30 p-3 font-body">
                  <div className="flex justify-between gap-3">
                    <span>{archetypeOption?.label ?? archetype} · {model?.label ?? modelKey}</span>
                    <span className="tabular-nums">${quote?.video.toFixed(2) ?? "—"}</span>
                  </div>
                  {archetype === "growth_reveal" && (
                    <div className="flex justify-between gap-3 text-muted-foreground">
                      <span>One high-quality matched start frame</span>
                      <span className="tabular-nums">${quote?.start.toFixed(2) ?? "—"}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 border-t border-border mt-2 pt-2 font-medium">
                    <span>Maximum confirmed estimate</span>
                    <span className="tabular-nums">${quote?.total.toFixed(2) ?? "—"}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  No automatic retry occurs. Stop blocks later stages and requests provider cancellation where supported, but already submitted work may remain billable.
                </p>
                <p className="text-xs text-muted-foreground">Pricing version: {options?.pricing_version ?? "loading"}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStarting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startTest} disabled={isStarting || !quote}>
              {isStarting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isStarting ? "Starting one test…" : `Confirm one test ($${quote?.total.toFixed(2) ?? "—"})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
