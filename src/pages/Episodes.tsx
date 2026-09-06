import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { EpisodePlanSummary } from "@/components/episodes/EpisodePlanSummary";
import { EpisodeShotPlan } from "@/components/episodes/EpisodeShotPlan";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContentHistory, type SavedContent } from "@/hooks/useBotanicalContent";
import { compileBotanicalEpisode, serializeEpisodePlan } from "@/lib/episodeCompiler";
import { CURATED_TOPICS } from "@/lib/episodeTopicRegistry";
import { EpisodePlanSchema, type EpisodePlan, type ExistingEpisodeSourceSchema, type ReviewFeedback } from "@/lib/episodeSchema";
import type { z } from "zod";
import { AlertTriangle, Clapperboard, Download, Info, Loader2, Sparkles } from "lucide-react";

type ExistingEpisodeSource = z.infer<typeof ExistingEpisodeSourceSchema>;

function toEpisodeSource(content: SavedContent): ExistingEpisodeSource {
  return {
    contentId: content.id,
    plantName: content.plant_name,
    assets: content.faceless_visuals.flatMap((visual) =>
      visual.image_url ? [{ moment: visual.moment, url: visual.image_url }] : [],
    ),
  };
}

export default function Episodes() {
  const { history, isLoading } = useContentHistory();
  const [topic, setTopic] = useState("Peanut");
  const [useGeneratedContent, setUseGeneratedContent] = useState(false);
  const [sourceId, setSourceId] = useState<string>("");
  const [plan, setPlan] = useState<EpisodePlan>(() => compileBotanicalEpisode({ topic: "Peanut" }));

  const selectedSource = useMemo(() => history.find((item) => item.id === sourceId), [history, sourceId]);
  const completedSources = useMemo(
    () => history.filter((item) => item.faceless_visuals.some((visual) => Boolean(visual.image_url))),
    [history],
  );

  const compile = () => {
    const source = useGeneratedContent && selectedSource ? toEpisodeSource(selectedSource) : undefined;
    setPlan(compileBotanicalEpisode({ topic: topic.trim() || selectedSource?.plant_name || "Unknown", ...(source ? { source } : {}) }));
  };

  const chooseCuratedTopic = (name: string) => {
    setTopic(name);
    const source = useGeneratedContent && selectedSource ? toEpisodeSource(selectedSource) : undefined;
    setPlan(compileBotanicalEpisode({ topic: name, ...(source ? { source } : {}) }));
  };

  const updateShotReview = (shotId: string, review: ReviewFeedback) => {
    setPlan((current) => EpisodePlanSchema.parse({
      ...current,
      shots: current.shots.map((shot) => shot.id === shotId ? { ...shot, review } : shot),
    }));
  };

  const hasReviewFeedback = plan.shots.some((shot) => shot.review.decision !== "pending" || shot.review.note.trim());

  const downloadPlan = () => {
    const contents = serializeEpisodePlan(plan);
    const blobUrl = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
    const link = document.createElement("a");
    const topicName = (plan.topicId ?? plan.topicQuery).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.href = blobUrl;
    link.download = `${topicName || "botanical"}-episode-plan-review.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Botanical Episode Planner"
        subtitle="Build the 52-second shot plan before spending on images or video"
        contained
      />

      <main className="container max-w-6xl py-6 md:py-8 space-y-6 pb-20">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="font-serif font-normal text-2xl">Plan an episode</CardTitle>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Choose a supported topic, optionally reuse stills from a generated package, then review every routed shot and its provisional planning budget.
                </p>
              </div>
              <div className="rounded-full border border-botanical/30 bg-botanical/5 px-3 py-1.5 text-xs text-botanical flex-shrink-0">
                No-spend preview
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="episode-topic">Topic</Label>
                <Input
                  id="episode-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") compile(); }}
                  placeholder="Peanut or strawberry"
                />
                <div className="flex flex-wrap gap-2">
                  {CURATED_TOPICS.map((candidate) => (
                    <Button key={candidate.id} type="button" size="sm" variant="outline" onClick={() => chooseCuratedTopic(candidate.commonName)}>
                      {candidate.commonName}
                    </Button>
                  ))}
                </div>
              </div>
              <Button type="button" size="lg" onClick={compile} className="md:min-w-40">
                <Sparkles className="mr-2 h-4 w-4" />
                Compile plan
              </Button>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="use-generated-content"
                  checked={useGeneratedContent}
                  onCheckedChange={(checked) => {
                    const enabled = checked === true;
                    setUseGeneratedContent(enabled);
                    if (!enabled) setSourceId("");
                  }}
                />
                <div className="flex-1 min-w-0">
                  <Label htmlFor="use-generated-content" className="cursor-pointer">Use generated image/content</Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Reuse compatible stills from an existing botanical package. The planner records missing continuity frames but does not generate them.
                  </p>
                </div>
              </div>

              {useGeneratedContent && (
                <div className="mt-4 pl-7">
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading generated content…</div>
                  ) : completedSources.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No completed generated images are available yet.</p>
                  ) : (
                    <Select value={sourceId} onValueChange={(value) => {
                      setSourceId(value);
                      const source = history.find((item) => item.id === value);
                      if (source) setTopic(source.plant_name);
                    }}>
                      <SelectTrigger className="max-w-xl"><SelectValue placeholder="Choose generated content" /></SelectTrigger>
                      <SelectContent>
                        {completedSources.map((item) => {
                          const imageCount = item.faceless_visuals.filter((visual) => visual.image_url).length;
                          return <SelectItem key={item.id} value={item.id}>{item.plant_name} · {imageCount} image{imageCount === 1 ? "" : "s"}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedSource && (
                    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                      {selectedSource.faceless_visuals.filter((visual) => visual.image_url).map((visual) => (
                        <img key={visual.moment} src={visual.image_url!} alt={`${selectedSource.plant_name} ${visual.moment}`} className="h-20 w-14 flex-shrink-0 rounded border border-border object-cover" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Planning only</AlertTitle>
              <AlertDescription>
                Compiling runs entirely in the browser. It does not call an AI provider, start a video job, charge an account, or save production data.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <EpisodePlanSummary plan={plan} />
        {plan.shots.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Review notes are browser-only</AlertTitle>
            <AlertDescription>
              Recompiling or leaving this page resets shot decisions and notes. Download the validated plan JSON before doing either{hasReviewFeedback ? "; this plan contains unsaved feedback" : ""}.
            </AlertDescription>
          </Alert>
        )}
        <EpisodeShotPlan plan={plan} onReviewChange={updateShotReview} />

        {plan.status === "ready" && (
          <div className="sticky bottom-4 rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 text-botanical" />
              <div>
                <p className="text-sm font-medium text-foreground">Reviewable plan compiled</p>
                  <p className="text-xs text-muted-foreground">{plan.estimates.paidGenerationCount} potential jobs · provisional budget ${plan.estimates.totalCostUsd.toFixed(2)} · current server quote still required</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={downloadPlan} aria-label="Download episode plan and review notes as JSON">
                <Download className="mr-2 h-4 w-4" />
                Download plan + review JSON
              </Button>
              <Button disabled variant="outline">Generation arrives in the next phase</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
