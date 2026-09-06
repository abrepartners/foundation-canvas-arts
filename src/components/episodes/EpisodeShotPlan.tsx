import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EpisodePlan, ReviewFeedback } from "@/lib/episodeSchema";
import { ArrowRight, CheckCircle2, CircleDotDashed, Clapperboard, Image, Lock, Volume2 } from "lucide-react";

const routeLabel = {
  editorial_still: "Editorial still",
  continuity_image: "Continuity still",
  paired_frame_video: "Paired-frame video",
  blocked: "Blocked",
} as const;

interface EpisodeShotPlanProps {
  plan: EpisodePlan;
  onReviewChange?: (shotId: string, review: ReviewFeedback) => void;
}

const motionLabel = {
  biological_motion: "Biological motion",
  editorial_motion: "Editorial motion",
  intentional_hold: "Intentional hold",
} as const;

export function EpisodeShotPlan({ plan, onReviewChange }: EpisodeShotPlanProps) {
  if (plan.shots.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-serif text-lg text-foreground">No generation plan created</p>
          <p className="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
            This topic needs a reviewed fact ledger and stage sequence. The planner has intentionally created no image or video jobs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <CardTitle className="font-serif font-normal text-xl">Editing timeline</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Every biological action appears as motion within its shot; holds and comparisons use restrained still movement.</p>
          </div>
          <p className="text-xs text-muted-foreground">{plan.shots.length} shots · {plan.totalDuration}s</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {plan.shots.map((shot) => {
          const video = shot.route.mode === "paired_frame_video";
          const passed = shot.gateStatus === "pass";
          return (
            <article key={shot.id} className="rounded-lg border border-border/70 bg-background/45 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                <div className="flex items-center gap-3 lg:w-52 lg:flex-shrink-0">
                  <div className="h-9 w-9 rounded-full bg-parchment flex items-center justify-center text-sm font-medium text-graphite">
                    {shot.id}
                  </div>
                  <div className="min-w-0">
                    <p className="font-serif text-base text-foreground truncate">{shot.label}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">{shot.start.toFixed(1)}–{shot.end.toFixed(1)}s · {shot.duration.toFixed(1)}s</p>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{shot.stageType}</Badge>
                    <Badge variant="outline">{shot.botanicalStage}</Badge>
                    <Badge variant={video ? "default" : "secondary"} className="gap-1">
                      {video ? <Clapperboard className="h-3 w-3" /> : <Image className="h-3 w-3" />}
                      {routeLabel[shot.route.mode]}
                    </Badge>
                    <Badge variant={passed ? "secondary" : "outline"} className="gap-1">
                      {passed ? <CheckCircle2 className="h-3 w-3" /> : <CircleDotDashed className="h-3 w-3" />}
                      {passed ? "Gate passed" : "Visual QA planned"}
                    </Badge>
                    <Badge variant="outline">{motionLabel[shot.motionIntent]}</Badge>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-foreground">{shot.narration}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Kinetic captions">
                    {shot.captions.map((caption, index) => (
                      <span key={`${shot.id}-${caption}-${index}`} className="rounded bg-secondary/70 px-2 py-1 text-[11px] font-medium tracking-wide text-secondary-foreground">
                        {caption}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                    <div className="rounded-md bg-muted/35 p-2.5">
                      <p className="font-medium text-foreground">Visual action: {shot.action}</p>
                      <p className="mt-1 leading-relaxed">{shot.visualDirection}</p>
                    </div>
                    <div className="rounded-md bg-muted/35 p-2.5">
                      <p className="font-medium text-foreground">Route: {shot.route.routeName}</p>
                      <p className="mt-1 leading-relaxed">{shot.route.reason}</p>
                    </div>
                  </div>

                  <div className="mt-2 rounded-md border border-border/55 bg-background/60 p-2.5 text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Volume2 className="h-3.5 w-3.5 text-botanical" />
                      Restrained sound cue
                    </div>
                    <p className="mt-1 text-muted-foreground">{shot.soundDesign.cue}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{shot.soundDesign.timing} · {shot.soundDesign.relationToVisual}</p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="font-medium text-foreground">Start</span> {shot.startAssetSlot}
                      {shot.endAssetSlot && <><ArrowRight className="h-3 w-3" /><span className="font-medium text-foreground">End</span> {shot.endAssetSlot}</>}
                    </span>
                    {shot.reusedAssetSlots.length > 0 && <span className="text-botanical">Reusing: {shot.reusedAssetSlots.join(", ")}</span>}
                    {shot.missingKeyframes.length > 0 && <span>Missing: {shot.missingKeyframes.join(", ")}</span>}
                  </div>

                  <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 md:grid-cols-[180px_minmax(0,1fr)]">
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Review decision</p>
                      <Select
                        value={shot.review.decision}
                        onValueChange={(decision: ReviewFeedback["decision"]) => onReviewChange?.(shot.id, { ...shot.review, decision })}
                        disabled={!onReviewChange}
                      >
                        <SelectTrigger className="h-9" aria-label={`Review decision for shot ${shot.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending review</SelectItem>
                          <SelectItem value="keep">Keep it</SelectItem>
                          <SelectItem value="change">Change it</SelectItem>
                          <SelectItem value="remove">Remove it</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Beat-level note</p>
                      <Textarea
                        value={shot.review.note}
                        onChange={(event) => onReviewChange?.(shot.id, { ...shot.review, note: event.target.value })}
                        disabled={!onReviewChange}
                        aria-label={`Review note for shot ${shot.id}`}
                        rows={2}
                        placeholder={`Add a note for shot ${shot.id}, such as timing, movement, sound, or anatomy changes.`}
                        className="min-h-[64px] resize-y text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}
