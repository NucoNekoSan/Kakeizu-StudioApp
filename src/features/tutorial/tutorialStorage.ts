import { readStorageMode } from "../../storage/storageMode";
import {
  emptyTutorialProgress,
  LEGACY_TUTORIAL_STORAGE_KEY,
  PREVIOUS_TUTORIAL_STORAGE_KEY,
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_VERSION,
  type TutorialProgress,
} from "./tutorialModel";

const storage = () =>
  readStorageMode() === "persistent" ? localStorage : sessionStorage;

export function readTutorialProgress(): TutorialProgress | null {
  try {
    const target = storage();
    const parsed = JSON.parse(
      target.getItem(TUTORIAL_STORAGE_KEY) ?? "null",
    ) as Partial<TutorialProgress> | null;
    if (parsed?.version === TUTORIAL_VERSION) return parsed as TutorialProgress;
    const previous = JSON.parse(
      target.getItem(PREVIOUS_TUTORIAL_STORAGE_KEY) ?? "null",
    ) as
      | (Omit<Partial<TutorialProgress>, "version"> & { version?: number })
      | null;
    if (previous?.version === 3) {
      const outputSteps = new Set([
        "png-preview",
        "png-export",
        "json-export",
        "settings-simulation",
      ]);
      const migrated: TutorialProgress = {
        ...emptyTutorialProgress(),
        ...previous,
        version: TUTORIAL_VERSION,
        completedChapters: (previous.completedChapters ?? []).filter(
          (chapter) => chapter !== "output",
        ),
        completedStepIds: (previous.completedStepIds ?? []).filter(
          (step) => !outputSteps.has(step),
        ),
        skippedRequiredStepIds: (previous.skippedRequiredStepIds ?? []).filter(
          (step) => !outputSteps.has(step),
        ),
        activeStepIndex:
          previous.activeChapterId === "output"
            ? 0
            : (previous.activeStepIndex ?? 0),
      };
      target.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    const legacy = JSON.parse(
      target.getItem(LEGACY_TUTORIAL_STORAGE_KEY) ?? "null",
    ) as {
      practiceChartId?: unknown;
      practiceChartKept?: unknown;
      promptDisabled?: unknown;
    } | null;
    if (!legacy) return null;
    const migrated: TutorialProgress = {
      ...emptyTutorialProgress(),
      practiceChartId:
        typeof legacy.practiceChartId === "string"
          ? legacy.practiceChartId
          : null,
      practiceChartKept: legacy.practiceChartKept === true,
      promptDisabled: legacy.promptDisabled === true,
      upgradedFromV2: true,
    };
    target.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return null;
  }
}

export function writeTutorialProgress(progress: TutorialProgress): void {
  try {
    storage().setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // 保存できない環境でも、Provider 内のメモリ状態で利用を続ける。
  }
}
