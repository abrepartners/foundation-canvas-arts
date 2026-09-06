import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EpisodePlan } from "@/lib/episodeSchema";
import { AlertTriangle, CheckCircle2, Clapperboard, Download, Image, Mic2, ShieldCheck, Volume2, WalletCards } from "lucide-react";

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clapperboard }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/55 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wide font-body">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-serif text-foreground">{value}</p>
    </div>
  );
}

export function EpisodePlanSummary({ plan }: { plan: EpisodePlan }) {
  const ready = plan.status === "ready";
  return (
    <div className="space-y-4">
      <Card className={ready ? "border-botanical/35" : "border-destructive/35"}>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {ready ? <CheckCircle2 className="h-5 w-5 text-botanical" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
                <Badge variant={ready ? "secondary" : "destructive"}>
                  {ready ? "Ready to review" : "Research required"}
                </Badge>
              </div>
              <CardTitle className="font-serif font-normal text-2xl">
                {plan.topicName ?? plan.topicQuery}
              </CardTitle>
              {plan.scientificName && (
                <p className="mt-1 text-sm italic text-muted-foreground">{plan.scientificName}</p>
              )}
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Recipe</p>
              <p className="text-sm font-medium text-foreground">{plan.recipeId}</p>
              <p className="mt-1 text-xs text-muted-foreground">Planning preview only · nothing submitted</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric label="Runtime" value={plan.totalDuration ? `${plan.totalDuration}s` : "Blocked"} icon={Clapperboard} />
            <Metric label="Shots" value={String(plan.shots.length)} icon={Clapperboard} />
            <Metric label="Video moments" value={String(plan.estimates.pairedFrameVideoCount)} icon={Clapperboard} />
            <Metric label="Missing stills" value={String(plan.estimates.continuityImageCount)} icon={Image} />
            <Metric label="Provisional budget" value={`$${plan.estimates.totalCostUsd.toFixed(2)}`} icon={WalletCards} />
          </div>

          {plan.source && (
            <div className="mt-4 rounded-md border border-border/60 bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">Using generated content: {plan.source.plantName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {plan.source.compatible
                    ? `${plan.source.reusedAssetCount} existing still${plan.source.reusedAssetCount === 1 ? "" : "s"} matched to continuity slots.`
                    : "This source does not match the topic, so its images will not be used."}
                </p>
              </div>
              <Badge variant={plan.source.compatible ? "secondary" : "outline"}>
                {plan.source.compatible ? "Compatible" : "Ignored"}
              </Badge>
            </div>
          )}

          <div className="mt-4 flex gap-3 rounded-md border border-border/60 p-3">
            <ShieldCheck className="h-5 w-5 flex-shrink-0 text-botanical mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {plan.plannerRoute.escalationRequired ? "Strong-model review required" : "Routine planner uses rules"}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground mt-1">{plan.plannerRoute.reason}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif font-normal text-lg">Production direction</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-md border border-border/60 bg-background/45 p-4">
            <div className="flex items-center gap-2">
              <Mic2 className="h-4 w-4 text-botanical" />
              <p className="text-sm font-medium text-foreground">Narrator</p>
            </div>
            <p className="mt-2 text-sm text-foreground">{plan.narratorProfile.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{plan.narratorProfile.direction}</p>
            <p className="mt-2 text-xs text-muted-foreground">Target: {plan.narratorProfile.targetWordsPerMinute} words/minute</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{plan.narratorProfile.pauseGuidance}</p>
            <div className="mt-2 rounded border border-border/50 p-2 text-[11px] text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span>{plan.narrationTiming.wordCount}/{plan.narrationTiming.maxWordsAtTargetPace} words</span>
                <Badge variant={plan.narrationTiming.status === "fits_estimate" ? "secondary" : "destructive"}>
                  {plan.narrationTiming.status === "fits_estimate" ? "Fits estimate" : "Needs trimming"}
                </Badge>
              </div>
              <p className="mt-1">≈{plan.narrationTiming.estimatedSpeechSeconds.toFixed(1)}s speech + {plan.narrationTiming.reservedPauseSeconds}s pause reserve</p>
              <p className="mt-1">Timed voice check still required before recording.</p>
            </div>
            <p className="mt-2 text-[11px] font-medium text-botanical">{plan.narratorProfile.originalityConstraint}</p>
          </div>

          <div className="rounded-md border border-border/60 bg-background/45 p-4">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-botanical" />
              <p className="text-sm font-medium text-foreground">Motion coverage</p>
            </div>
            <p className="mt-2 font-serif text-3xl text-foreground">{plan.motionCoverage.movingShotPercent}%</p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>{plan.motionCoverage.biologicalMotionShots} biological motion shots</p>
              <p>{plan.motionCoverage.editorialMotionShots} editorial motion shots</p>
              <p>{plan.motionCoverage.intentionalHoldShots} intentional hold shots</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{plan.motionCoverage.rationale}</p>
          </div>

          <div className="rounded-md border border-border/60 bg-background/45 p-4">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-botanical" />
              <p className="text-sm font-medium text-foreground">Export plan</p>
            </div>
            <div className="mt-2 space-y-2">
              {plan.exportProfiles.map((profile) => (
                <div key={profile.platform} className="rounded border border-border/50 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{profile.label}</p>
                    <Badge variant="outline">Posting off</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{profile.resolution} · {profile.frameRate} fps · {profile.deliveryMode}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Exports are planned for download only. Publishing remains a future phase.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif font-normal text-lg">Quality gates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {plan.gates.map((gate) => (
            <div key={gate.id} className="rounded-md border border-border/60 bg-background/45 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{gate.label}</p>
                <Badge variant={gate.status === "blocked" ? "destructive" : gate.status === "pass" ? "secondary" : "outline"}>
                  {gate.status === "pass" ? "Pass" : gate.status === "planned" ? "Planned" : "Blocked"}
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{gate.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {plan.sources.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-serif font-normal text-lg">Evidence ledger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {plan.sources.map((source) => (
              <div key={source.url} className="rounded-md border border-border/60 bg-background/45 p-3">
                <a href={source.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                  {source.title}
                </a>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Supports: {source.supports.join(", ")}.</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
