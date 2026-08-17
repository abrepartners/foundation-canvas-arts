import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Lock, Play, RefreshCw, Upload, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const MODEL = "bytedance/seedream-5-pro";
const COST_PER_RUN = 0.045;
const MAX_INPUT_BYTES = 240 * 1024;
const STORAGE_KEY = "adaptive-reuse-benchmark-stage1";

const DEFAULT_PROMPT = `Use the supplied listing photograph as the only spatial reference. Create an image edit of this exact room, not a redesign.

Remove all movable church-specific contents: pews, pulpit or lectern, altar furniture, freestanding chairs, flowers and plants, flags, Christmas tree and seasonal decor, projection screen or movable presentation equipment, freestanding religious decor, and other movable furnishings. Remove visible cross or religious symbols from fixture surfaces while keeping the physical light fixtures in exactly the same positions and shapes.

Preserve every permanent architectural feature exactly: camera viewpoint, crop, lens and perspective, vanishing point, vaulted wood ceiling, exposed wood beams, wall geometry, windows, doors, raised platform or stage, floor geometry and material, lighting fixture locations, room proportions, and existing finishes.

Do not renovate, modernize, restyle, repaint, add or remove openings, alter beam spacing, alter the platform, change materials, move the camera, crop, zoom, add people, or add new furniture.

The final image should look like the same real-estate photograph taken seconds later after the movable church contents were physically removed, leaving a clean, empty commercial or assembly space. Photorealistic real-estate photography.`;

type BenchmarkRun = {
  predictionId: string;
  output: string | null;
  status: string;
  prompt: string;
  estimatedCost: number;
  metrics?: Record<string, unknown> | null;
  createdAt: string;
};

type BenchmarkResponse = {
  prediction_id?: string;
  status?: string;
  output?: string | null;
  error?: string | null;
  metrics?: Record<string, unknown> | null;
};

const terminal = new Set(["succeeded", "failed", "canceled"]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image"));
    reader.readAsDataURL(blob);
  });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to decode image"));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressForReplicate(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");

  const source = await loadImage(file);
  let width = Math.min(source.naturalWidth, 1600);
  let height = Math.round((source.naturalHeight / source.naturalWidth) * width);
  let quality = 0.76;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser image processing is unavailable");
    context.drawImage(source, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Unable to compress image"))), "image/jpeg", quality);
    });

    if (blob.size <= MAX_INPUT_BYTES) return blobToDataUrl(blob);

    if (quality > 0.55) quality -= 0.07;
    else {
      width = Math.round(width * 0.88);
      height = Math.round(height * 0.88);
    }
  }

  throw new Error("Could not compress this image enough for the benchmark. Try a smaller JPEG.");
}

const AdaptiveReuseBenchmark = () => {
  const navigate = useNavigate();
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvedRunId, setApprovedRunId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed?.runs)) setRuns(parsed.runs);
      if (typeof parsed?.approvedRunId === "string") setApprovedRunId(parsed.approvedRunId);
    } catch {
      // A corrupt local benchmark cache should never block the workbench.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ runs, approvedRunId }));
  }, [runs, approvedRunId]);

  const latestRun = runs[0] ?? null;
  const estimatedSpend = useMemo(
    () => runs.reduce((sum, run) => sum + run.estimatedCost, 0),
    [runs],
  );

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsPreparingImage(true);
    setError(null);
    try {
      const dataUrl = await compressForReplicate(file);
      setSourceUrl(dataUrl);
      setApprovedRunId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPreparingImage(false);
      event.target.value = "";
    }
  };

  const pollPrediction = async (predictionId: string, initial: BenchmarkResponse) => {
    let result = initial;
    for (let attempt = 0; attempt < 90 && !terminal.has(result.status ?? ""); attempt += 1) {
      await sleep(2000);
      const { data, error: invokeError } = await supabase.functions.invoke("adaptive-reuse-benchmark", {
        body: { action: "status", prediction_id: predictionId },
      });
      if (invokeError) throw invokeError;
      result = data as BenchmarkResponse;
    }
    return result;
  };

  const runStageOne = async () => {
    if (!sourceUrl || !prompt.trim() || isRunning) return;
    setIsRunning(true);
    setError(null);
    setApprovedRunId(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("adaptive-reuse-benchmark", {
        body: { action: "submit", image_data_url: sourceUrl, prompt: prompt.trim() },
      });
      if (invokeError) throw invokeError;

      let result = data as BenchmarkResponse;
      if (result.error) throw new Error(result.error);
      if (!result.prediction_id) throw new Error("Replicate did not return a prediction ID");

      if (!terminal.has(result.status ?? "")) {
        result = await pollPrediction(result.prediction_id, result);
      }

      const run: BenchmarkRun = {
        predictionId: result.prediction_id,
        output: result.output ?? null,
        status: result.status ?? "unknown",
        prompt: prompt.trim(),
        estimatedCost: COST_PER_RUN,
        metrics: result.metrics ?? null,
        createdAt: new Date().toISOString(),
      };

      setRuns((current) => [run, ...current]);
      if (result.status !== "succeeded") {
        throw new Error(result.error || `Generation ended with status: ${result.status ?? "unknown"}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const stages = [
    { number: "01", label: "Clear Space", state: approvedRunId ? "approved" : "active" },
    { number: "02", label: "Reimagine", state: "locked" },
    { number: "03", label: "Transform", state: "locked" },
    { number: "04", label: "Review", state: "locked" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/70 backdrop-blur">
        <div className="container flex h-16 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-serif text-lg leading-tight">Adaptive Reuse Benchmark</h1>
            <p className="text-xs text-muted-foreground">One paid test at a time. Nothing advances automatically.</p>
          </div>
          <div className="ml-auto text-right text-xs text-muted-foreground">
            <div>{MODEL}</div>
            <div>Estimated benchmark spend: ${estimatedSpend.toFixed(3)}</div>
          </div>
        </div>
      </header>

      <main className="container space-y-6 py-6 md:py-8">
        <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {stages.map((stage) => (
            <div
              key={stage.number}
              className={`rounded-lg border p-3 ${stage.state === "active" ? "border-foreground bg-card" : stage.state === "approved" ? "border-emerald-500/50 bg-emerald-500/5" : "bg-muted/30 text-muted-foreground"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{stage.number}</span>
                {stage.state === "approved" ? <CheckCircle2 className="h-4 w-4" /> : stage.state === "locked" ? <Lock className="h-3.5 w-3.5" /> : null}
              </div>
              <div className="mt-2 text-sm font-medium">{stage.label}</div>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Stage 01</p>
              <h2 className="font-serif text-2xl">Clear the existing use</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Same property, same camera, same architecture. Remove the church-specific movable contents only.
              </p>
            </div>
            <div className="hidden text-right text-xs text-muted-foreground sm:block">
              <div>1 output · 1K · match input</div>
              <div>~$0.045 per run</div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="relative flex aspect-[3/2] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/20">
                {sourceUrl ? (
                  <img src={sourceUrl} alt="Benchmark source" className="h-full w-full object-contain" />
                ) : (
                  <div className="text-center text-sm text-muted-foreground">
                    <Upload className="mx-auto mb-2 h-5 w-5" />
                    <div>{isPreparingImage ? "Preparing image..." : "Upload the church listing photo"}</div>
                    <div className="mt-1 text-xs">The browser compresses a test copy before Replicate.</div>
                  </div>
                )}
                <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={isPreparingImage || isRunning} />
              </label>
              {sourceUrl && (
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                  <Upload className="h-3.5 w-3.5" /> Replace source image
                  <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={isPreparingImage || isRunning} />
                </label>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Stage 1 output</CardTitle>
                {latestRun && <span className="text-xs text-muted-foreground">{latestRun.status}</span>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex aspect-[3/2] items-center justify-center overflow-hidden rounded-lg border bg-muted/20">
                {isRunning ? (
                  <div className="text-center text-sm text-muted-foreground">
                    <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Running one Seedream test...
                  </div>
                ) : latestRun?.output ? (
                  <img src={latestRun.output} alt="Stage 1 output" className="h-full w-full object-contain" />
                ) : (
                  <div className="text-center text-sm text-muted-foreground">No credits spent yet.</div>
                )}
              </div>

              {latestRun && (
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="rounded-md border p-2">Prediction<br /><span className="font-mono text-foreground">{latestRun.predictionId.slice(0, 16)}…</span></div>
                  <div className="rounded-md border p-2">Estimated cost<br /><span className="text-foreground">${latestRun.estimatedCost.toFixed(3)}</span></div>
                </div>
              )}

              {latestRun?.status === "succeeded" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setApprovedRunId(latestRun.predictionId)} disabled={approvedRunId === latestRun.predictionId}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {approvedRunId === latestRun.predictionId ? "Approved" : "Approve Stage 1"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setApprovedRunId(null)}>
                    <XCircle className="mr-2 h-4 w-4" /> Needs refinement
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Prompt</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setPrompt(DEFAULT_PROMPT)} disabled={isRunning}>
                Reset prompt
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={12} disabled={isRunning} className="font-mono text-xs leading-relaxed" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Run only when the source and wording look right. Every click creates exactly one paid Replicate prediction.
              </p>
              <Button onClick={runStageOne} disabled={!sourceUrl || !prompt.trim() || isRunning || isPreparingImage}>
                {isRunning ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Run Stage 1 · ~$0.045
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {runs.length > 1 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Previous attempts</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {runs.slice(1).map((run, index) => (
                <button
                  key={run.predictionId}
                  type="button"
                  className="overflow-hidden rounded-lg border text-left hover:bg-muted/30"
                  onClick={() => setRuns((current) => [run, ...current.filter((item) => item.predictionId !== run.predictionId)])}
                >
                  <div className="aspect-[3/2] bg-muted/20">{run.output && <img src={run.output} alt={`Attempt ${index + 2}`} className="h-full w-full object-contain" />}</div>
                  <div className="p-2 text-xs text-muted-foreground">Attempt {runs.length - index - 1} · {run.status}</div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AdaptiveReuseBenchmark;
