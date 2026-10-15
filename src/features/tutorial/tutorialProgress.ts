import {
  chapterById,
  requiredStepIds,
  routeForStep,
  type TutorialChapterId,
  type TutorialProgress,
  type TutorialStep,
} from "./tutorialModel";

export function startTutorialProgress(
  current: TutorialProgress,
  id: TutorialChapterId,
  options: {
    isResuming: boolean;
    stepIndex: number;
    practiceChartId: string | null;
  },
): TutorialProgress {
  const { isResuming, stepIndex, practiceChartId } = options;
  const chapter = chapterById(id);
  const isReplay = current.completedChapters.includes(id) && !isResuming;
  const stepIds = new Set(chapter.steps.map((step) => step.id));
  return {
    ...current,
    completedChapters: isReplay
      ? current.completedChapters.filter((chapterId) => chapterId !== id)
      : current.completedChapters,
    completedStepIds: isReplay
      ? current.completedStepIds.filter((stepId) => !stepIds.has(stepId))
      : current.completedStepIds,
    skippedRequiredStepIds: isReplay
      ? current.skippedRequiredStepIds.filter((stepId) => !stepIds.has(stepId))
      : current.skippedRequiredStepIds,
    activeChapterId: id,
    activeStepIndex: stepIndex,
    paused: false,
    practiceChartId: practiceChartId ?? current.practiceChartId,
  };
}

type StepTransition =
  | { kind: "move"; stepIndex: number; outcome?: "completed" | "skipped" }
  | {
      kind: "practice-created";
      stepIndex: number;
      step: TutorialStep;
      chapterId: TutorialChapterId;
      chartId: string;
      outcome: "completed" | "skipped";
    };

/** Return only the changed fields so unrelated concurrent updates survive. */
export function transitionTutorialProgress(
  progress: TutorialProgress,
  transition: StepTransition,
): { changes: Partial<TutorialProgress>; route: string } {
  if (transition.kind === "practice-created") {
    const { stepIndex, step, chartId, outcome } = transition;
    const chapter = chapterById(transition.chapterId);
    // Creating the practice chart records progress immediately; the Provider
    // controls when navigation occurs. Skipping retains existing completion marks.
    const changes: Partial<TutorialProgress> =
      outcome === "completed"
        ? {
            practiceChartId: chartId,
            practiceChartKept: false,
            activeStepIndex: stepIndex,
            completedStepIds: Array.from(
              new Set([...progress.completedStepIds, step.id]),
            ),
            skippedRequiredStepIds: progress.skippedRequiredStepIds.filter(
              (id) => id !== step.id,
            ),
          }
        : {
            activeStepIndex: stepIndex,
            practiceChartId: chartId,
            skippedRequiredStepIds: Array.from(
              new Set([...progress.skippedRequiredStepIds, step.id]),
            ),
          };
    return { changes, route: routeForStep(chapter.steps[stepIndex], chartId) };
  }
  if (!progress.activeChapterId || progress.paused)
    return { changes: {}, route: "/tutorial" };
  const chapter = chapterById(progress.activeChapterId);
  const currentStep = chapter.steps[progress.activeStepIndex];
  const completedStepIds = new Set(progress.completedStepIds);
  const skippedStepIds = new Set(progress.skippedRequiredStepIds);
  if (transition.outcome === "completed") {
    completedStepIds.add(currentStep.id);
    skippedStepIds.delete(currentStep.id);
  } else if (transition.outcome === "skipped" && currentStep.required) {
    completedStepIds.delete(currentStep.id);
    skippedStepIds.add(currentStep.id);
  }
  if (transition.stepIndex >= chapter.steps.length) {
    const mastered = requiredStepIds(chapter).every((id) =>
      completedStepIds.has(id),
    );
    return {
      changes: {
        completedChapters: mastered
          ? Array.from(new Set([...progress.completedChapters, chapter.id]))
          : progress.completedChapters.filter((id) => id !== chapter.id),
        completedStepIds: [...completedStepIds],
        skippedRequiredStepIds: [...skippedStepIds],
        activeChapterId: null,
        activeStepIndex: 0,
        paused: false,
      },
      route: "/tutorial",
    };
  }
  const index = Math.max(0, transition.stepIndex);
  return {
    changes: {
      activeStepIndex: index,
      completedStepIds: [...completedStepIds],
      skippedRequiredStepIds: [...skippedStepIds],
    },
    route: routeForStep(chapter.steps[index], progress.practiceChartId),
  };
}
