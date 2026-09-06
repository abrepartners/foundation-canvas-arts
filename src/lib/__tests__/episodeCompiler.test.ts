import { describe, expect, it } from "vitest";
import { compileBotanicalEpisode, PHYSICAL_ACTIONS, serializeEpisodePlan } from "@/lib/episodeCompiler";
import { EpisodePlanSchema } from "@/lib/episodeSchema";

const completePeanutSource = {
  contentId: "content-peanut-1",
  plantName: "Peanut (Arachis hypogaea)",
  assets: [
    { moment: "hook" as const, url: "https://assets.example/peanut-hook.jpg" },
    { moment: "dangle_1" as const, url: "https://assets.example/peanut-flower.jpg" },
    { moment: "rehook" as const, url: "https://assets.example/peanut-peg.jpg" },
    { moment: "dangle_2" as const, url: "https://assets.example/peanut-soil.jpg" },
    { moment: "verified_truth" as const, url: "https://assets.example/peanut-anatomy.jpg" },
    { moment: "close" as const, url: "https://assets.example/peanut-close.jpg" },
  ],
};

describe("botanical-video-v2 compiler", () => {
  it("compiles exactly 13 contiguous shots into the 52-second target", () => {
    const plan = compileBotanicalEpisode({ topic: "Peanut" });

    expect(plan.status).toBe("ready");
    expect(plan.shots).toHaveLength(13);
    expect(plan.totalDuration).toBe(52);
    expect(plan.shots[0].start).toBe(0);
    expect(plan.shots[plan.shots.length - 1]?.end).toBe(52);
    plan.shots.slice(1).forEach((shot, index) => {
      expect(shot.start).toBe(plan.shots[index].end);
    });
  });

  it("blocks unknown topics before creating any paid route", () => {
    const plan = compileBotanicalEpisode({ topic: "Dragon glass orchid" });

    expect(plan.status).toBe("needs_research");
    expect(plan.plannerRoute.escalationRequired).toBe(true);
    expect(plan.shots).toEqual([]);
    expect(plan.generationJobs).toEqual([]);
    expect(plan.estimates).toEqual({
      paidGenerationCount: 0,
      continuityImageCount: 0,
      pairedFrameVideoCount: 0,
      totalCostUsd: 0,
      initialTestBudgetUsd: 5,
    });
  });

  it("keeps every kinetic caption refresh to one-to-three words", () => {
    for (const topic of ["Peanut", "Strawberry"]) {
      const plan = compileBotanicalEpisode({ topic });
      const phrases = plan.shots.flatMap((shot) => shot.captions);

      expect(phrases.length).toBeGreaterThan(0);
      for (const phrase of phrases) {
        expect(phrase.trim().split(/\s+/).length).toBeGreaterThanOrEqual(1);
        expect(phrase.trim().split(/\s+/).length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("routes physical transformations to paired-frame video and holds to editorial motion", () => {
    const plan = compileBotanicalEpisode({ topic: "Peanut", source: completePeanutSource });

    for (const shot of plan.shots) {
      if (PHYSICAL_ACTIONS.has(shot.action)) {
        expect(shot.route.mode).toBe("paired_frame_video");
      }
    }
    expect(plan.shots.find((shot) => shot.action === "turn")?.route.mode).toBe("paired_frame_video");
    expect(plan.shots.find((shot) => shot.action === "hold")?.route.mode).toBe("editorial_still");
  });

  it("totals unique continuity frames plus each physical video exactly once", () => {
    const plan = compileBotanicalEpisode({ topic: "Peanut" });

    expect(plan.estimates.continuityImageCount).toBe(12);
    expect(plan.estimates.pairedFrameVideoCount).toBe(7);
    expect(plan.estimates.paidGenerationCount).toBe(19);
    expect(plan.estimates.totalCostUsd).toBe(2.56);
    expect(plan.generationJobs.map((job) => job.id).length).toBe(new Set(plan.generationJobs.map((job) => job.id)).size);
    const turnJob = plan.generationJobs.find((job) => job.id === "video:06");
    expect(turnJob).toMatchObject({
      plannedDurationSeconds: 5,
      estimatedCostPerSecondUsd: 0.04,
      estimatedCostUsd: 0.2,
    });
  });

  it("reuses only compatible generated URLs and reports the remaining keyframes", () => {
    const reused = compileBotanicalEpisode({ topic: "Peanut", source: completePeanutSource });
    const mismatched = compileBotanicalEpisode({
      topic: "Strawberry",
      source: completePeanutSource,
    });

    expect(reused.source).toMatchObject({ compatible: true, reusedAssetCount: 6 });
    expect(reused.assets.filter((asset) => asset.status === "reused")).toHaveLength(6);
    expect(reused.estimates.continuityImageCount).toBe(6);
    expect(reused.estimates.totalCostUsd).toBe(1.84);

    expect(mismatched.source).toMatchObject({ compatible: false, reusedAssetCount: 0 });
    expect(mismatched.assets.every((asset) => asset.status === "missing")).toBe(true);
    expect(mismatched.assets.some((asset) => "sourceUrl" in asset)).toBe(false);
  });

  it("never treats metadata-compatible reused assets as visually QA-passed", () => {
    const plan = compileBotanicalEpisode({ topic: "Peanut", source: completePeanutSource });

    expect(plan.source).toMatchObject({ compatible: true, reusedAssetCount: 6 });
    expect(plan.shots.every((shot) => shot.gateStatus === "planned")).toBe(true);
    expect(plan.gates.find((gate) => gate.id === "source.compatibility")?.status).toBe("planned");
    for (const gateId of ["topic.anatomy", "topic.counts", "topic.connections", "topic.order"]) {
      expect(plan.gates.find((gate) => gate.id === gateId)?.status).toBe("planned");
    }
  });

  it("backs every ready curated topic with authoritative source links", () => {
    for (const topic of ["Peanut", "Strawberry"]) {
      const plan = compileBotanicalEpisode({ topic });

      expect(plan.status).toBe("ready");
      expect(plan.sources.length).toBeGreaterThan(0);
      for (const source of plan.sources) {
        const url = new URL(source.url);
        expect(url.protocol).toBe("https:");
        expect(["www.ars.usda.gov", "cris.huji.ac.il", "content.ces.ncsu.edu", "homegarden.cahnr.uconn.edu"]).toContain(url.hostname);
        expect(source.supports.length).toBeGreaterThan(0);
      }
    }
    expect(compileBotanicalEpisode({ topic: "Peanut" }).sources).toHaveLength(3);
  });

  it("plans dense biological motion and action-timed restrained sound", () => {
    const plan = compileBotanicalEpisode({ topic: "Peanut" });

    expect(plan.motionCoverage).toMatchObject({
      biologicalMotionShots: 7,
      editorialMotionShots: 5,
      intentionalHoldShots: 1,
      movingShotPercent: 92,
    });
    expect(
      plan.motionCoverage.biologicalMotionShots +
      plan.motionCoverage.editorialMotionShots +
      plan.motionCoverage.intentionalHoldShots,
    ).toBe(plan.shots.length);
    for (const shot of plan.shots) {
      expect(shot.soundDesign.intensity).toBe("subtle");
      if (PHYSICAL_ACTIONS.has(shot.action)) {
        expect(shot.motionIntent).toBe("biological_motion");
        expect(shot.route.mode).toBe("paired_frame_video");
        expect(shot.soundDesign.timing).toContain(`visible ${shot.action}`);
      }
      if (shot.action === "hold") expect(shot.motionIntent).toBe("intentional_hold");
    }
  });

  it("uses an original measured narrator profile and export-only short-form profiles", () => {
    const plan = compileBotanicalEpisode({ topic: "Strawberry" });
    const narratorText = Object.values(plan.narratorProfile).join(" ");

    expect(plan.narratorProfile.accent).toBe("British English");
    expect(plan.narratorProfile.engine).toBe("Kokoro-82M");
    expect(plan.narratorProfile.voiceId).toBe("bm_fable");
    expect(plan.narratorProfile.targetWordsPerMinute).toBe(135);
    expect(narratorText).not.toMatch(/attenborough|david/i);
    expect(plan.narratorProfile.originalityConstraint).toMatch(/original performance/i);
    expect(plan.narrationTiming.status).toBe("fits_estimate");
    expect(plan.narrationTiming.wordCount).toBeLessThanOrEqual(plan.narrationTiming.maxWordsAtTargetPace);
    expect(plan.narrationTiming.estimatedTotalSeconds).toBeLessThanOrEqual(plan.totalDuration);
    expect(plan.narrationTiming.readyToRecord).toBe(false);
    expect(plan.exportProfiles.map((profile) => profile.platform)).toEqual([
      "tiktok", "instagram_reels", "youtube_shorts",
    ]);
    expect(plan.exportProfiles.every((profile) => !profile.postingEnabled && profile.deliveryMode === "export-only")).toBe(true);
    expect(plan.estimates.initialTestBudgetUsd).toBe(5);
  });

  it("represents shot-level keep/change/remove feedback without external writes", () => {
    const plan = compileBotanicalEpisode({ topic: "Peanut" });
    expect(plan.shots.every((shot) => shot.review.decision === "pending" && shot.review.note === "")).toBe(true);

    const reviewed = EpisodePlanSchema.parse({
      ...plan,
      shots: plan.shots.map((shot) => shot.id === "06"
        ? { ...shot, review: { decision: "change", note: "Hold the sideways turn half a second longer." } }
        : shot),
    });
    expect(reviewed.shots.find((shot) => shot.id === "06")?.review).toEqual({
      decision: "change",
      note: "Hold the sideways turn half a second longer.",
    });
    expect(EpisodePlanSchema.parse(JSON.parse(serializeEpisodePlan(reviewed)))).toEqual(reviewed);
  });

  it("keeps curated captions synchronized to the trimmed narration wording", () => {
    const normalize = (value: string) => value
      .toLowerCase()
      .replace(/[’]/g, "'")
      .replace(/[^a-z0-9']+/g, " ")
      .trim();

    for (const topic of ["Peanut", "Strawberry"]) {
      const plan = compileBotanicalEpisode({ topic });
      expect(plan.gates.find((gate) => gate.id === "narration.pacing_budget")?.status).toBe("planned");
      for (const shot of plan.shots) {
        const narration = normalize(shot.narration);
        for (const caption of shot.captions) expect(narration).toContain(normalize(caption));
        expect(normalize(shot.captions.join(" "))).toBe(narration);
      }
    }
  });

  it("keeps reusable filling sound count-agnostic", () => {
    const fillShot = compileBotanicalEpisode({ topic: "Peanut" }).shots.find((shot) => shot.action === "fill");
    expect(fillShot?.soundDesign.cue).not.toMatch(/\btwo\b/i);
    expect(fillShot?.soundDesign.relationToVisual).toContain("fill");
  });
});
