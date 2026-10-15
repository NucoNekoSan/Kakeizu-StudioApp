import { describe, expect, it } from "vitest";
import {
  chapterById,
  emptyTutorialProgress,
  requiredStepIds,
  type TutorialProgress,
} from "./tutorialModel";
import {
  startTutorialProgress,
  transitionTutorialProgress,
} from "./tutorialProgress";

const family = chapterById("family");
const progress = (
  overrides: Partial<TutorialProgress> = {},
): TutorialProgress => ({
  ...emptyTutorialProgress(),
  activeChapterId: "family",
  practiceChartId: "practice",
  ...overrides,
});

describe("tutorial progress transitions", () => {
  it("resumes a paused chapter without losing its step or completion marks", () => {
    const current = progress({
      paused: true,
      activeStepIndex: 2,
      completedStepIds: [family.steps[0].id],
    });
    const next = startTutorialProgress(current, "family", {
      isResuming: true,
      stepIndex: 2,
      practiceChartId: "practice",
    });
    expect(next).toEqual({ ...current, paused: false });
  });

  it("replaying a completed chapter clears only that chapter's marks", () => {
    const otherStep = chapterById("intro").steps[0].id;
    const current = progress({
      completedChapters: ["intro", "family"],
      completedStepIds: [otherStep, family.steps[0].id],
      skippedRequiredStepIds: [otherStep, family.steps[1].id],
    });
    const next = startTutorialProgress(current, "family", {
      isResuming: false,
      stepIndex: 0,
      practiceChartId: null,
    });
    expect(next.completedChapters).toEqual(["intro"]);
    expect(next.completedStepIds).toEqual([otherStep]);
    expect(next.skippedRequiredStepIds).toEqual([otherStep]);
    expect(next.practiceChartId).toBe("practice");
    expect(current.completedChapters).toEqual(["intro", "family"]);
  });

  it("completing a skipped step removes its skipped mark and navigates to the practice chart", () => {
    const current = progress({ skippedRequiredStepIds: [family.steps[0].id] });
    const next = transitionTutorialProgress(current, {
      kind: "move",
      stepIndex: 1,
      outcome: "completed",
    });
    expect(next.changes.completedStepIds).toEqual([family.steps[0].id]);
    expect(next.changes.skippedRequiredStepIds).toEqual([]);
    expect(next.route).toBe("/charts/practice");
    expect(current.completedStepIds).toEqual([]);
  });

  it("skipping a required step removes its completion mark", () => {
    const next = transitionTutorialProgress(
      progress({ completedStepIds: [family.steps[0].id] }),
      { kind: "move", stepIndex: 1, outcome: "skipped" },
    );
    expect(next.changes.completedStepIds).toEqual([]);
    expect(next.changes.skippedRequiredStepIds).toEqual([family.steps[0].id]);
  });

  it("moving backward preserves marks and clamps at the first step", () => {
    const current = progress({
      completedStepIds: [family.steps[0].id],
      skippedRequiredStepIds: [family.steps[1].id],
    });
    const next = transitionTutorialProgress(current, {
      kind: "move",
      stepIndex: -1,
    });
    expect(next.changes).toEqual({
      activeStepIndex: 0,
      completedStepIds: current.completedStepIds,
      skippedRequiredStepIds: current.skippedRequiredStepIds,
    });
  });

  it.each([true, false])(
    "chapter completion requires every required step: %s",
    (mastered) => {
      const required = requiredStepIds(family);
      const current = progress({
        activeStepIndex: family.steps.length - 1,
        completedChapters: ["intro", "family"],
        completedStepIds: mastered ? required : required.slice(1),
      });
      const next = transitionTutorialProgress(current, {
        kind: "move",
        stepIndex: family.steps.length,
        outcome: "completed",
      });
      expect(next.changes.completedChapters).toEqual(
        mastered ? ["intro", "family"] : ["intro"],
      );
      expect(next.changes.activeChapterId).toBeNull();
      expect(next.changes.activeStepIndex).toBe(0);
      expect(next.route).toBe("/tutorial");
    },
  );

  it.each(["completed", "skipped"] as const)(
    "records practice chart creation with outcome %s",
    (outcome) => {
      const intro = chapterById("intro");
      const stepIndex = intro.steps.findIndex(
        (step) => step.action === "chart-created",
      );
      const step = intro.steps[stepIndex];
      const current = progress({
        activeChapterId: "intro",
        activeStepIndex: stepIndex,
        practiceChartKept: true,
        skippedRequiredStepIds: [step.id],
      });
      const next = transitionTutorialProgress(current, {
        kind: "practice-created",
        chapterId: "intro",
        step,
        stepIndex: stepIndex + 1,
        chartId: "new-practice",
        outcome,
      });
      const updated = { ...current, ...next.changes };
      expect(updated.practiceChartId).toBe("new-practice");
      expect(updated.activeStepIndex).toBe(stepIndex + 1);
      expect(updated.practiceChartKept).toBe(outcome === "skipped");
      expect(updated.completedStepIds).toEqual(
        outcome === "completed" ? [step.id] : [],
      );
      expect(updated.skippedRequiredStepIds).toEqual(
        outcome === "skipped" ? [step.id] : [],
      );
      expect(next.route).toBe("/charts/new-practice");
    },
  );

  it("skipping practice creation preserves pre-existing completion marks", () => {
    const step = chapterById("intro").steps[0];
    const current = progress({ completedStepIds: [step.id] });
    const next = transitionTutorialProgress(current, {
      kind: "practice-created",
      chapterId: "intro",
      step,
      stepIndex: 1,
      chartId: "new",
      outcome: "skipped",
    });
    expect({ ...current, ...next.changes }.completedStepIds).toEqual([step.id]);
  });
});
