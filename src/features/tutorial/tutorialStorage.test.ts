// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { writeStorageMode } from "../../storage/storageMode";
import { emptyTutorialProgress, TUTORIAL_STORAGE_KEY } from "./tutorialModel";
import {
  LEGACY_TUTORIAL_STORAGE_KEY,
  PREVIOUS_TUTORIAL_STORAGE_KEY,
} from "./tutorialModel";
import { readTutorialProgress, writeTutorialProgress } from "./tutorialStorage";

describe("チュートリアル進捗の保存", () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("端末保存モードではlocalStorageに保存する", () => {
    writeStorageMode("persistent");
    const progress = emptyTutorialProgress();
    writeTutorialProgress(progress);
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBeTruthy();
    expect(readTutorialProgress()).toEqual(progress);
  });

  it("一時利用モードではsessionStorageに保存する", () => {
    writeStorageMode("session");
    writeTutorialProgress(emptyTutorialProgress());
    expect(sessionStorage.getItem(TUTORIAL_STORAGE_KEY)).toBeTruthy();
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBeNull();
  });

  it("不正または古いバージョンは読み込まない", () => {
    writeStorageMode("persistent");
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '{"version":1}');
    expect(readTutorialProgress()).toBeNull();
  });

  it("v2からオプトアウトと練習用相関図だけを引き継ぐ", () => {
    writeStorageMode("persistent");
    localStorage.setItem(
      LEGACY_TUTORIAL_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        completedChapters: ["basics"],
        practiceChartId: "practice-old",
        practiceChartKept: true,
        promptDisabled: true,
      }),
    );
    const migrated = readTutorialProgress();
    expect(migrated?.version).toBe(4);
    expect(migrated?.completedChapters).toEqual([]);
    expect(migrated?.practiceChartId).toBe("practice-old");
    expect(migrated?.promptDisabled).toBe(true);
    expect(migrated?.upgradedFromV2).toBe(true);
  });

  it("v3から出力章だけをリセットし、他の進捗を引き継ぐ", () => {
    writeStorageMode("persistent");
    localStorage.setItem(
      PREVIOUS_TUTORIAL_STORAGE_KEY,
      JSON.stringify({
        ...emptyTutorialProgress(),
        version: 3,
        completedChapters: ["intro", "output"],
        completedStepIds: [
          "welcome",
          "png-preview",
          "png-export",
          "json-export",
          "settings-simulation",
        ],
        skippedRequiredStepIds: ["png-export", "other-step"],
        activeChapterId: "output",
        activeStepIndex: 3,
        practiceChartId: "practice-v3",
        paused: true,
      }),
    );
    const migrated = readTutorialProgress();
    expect(migrated).toMatchObject({
      version: 4,
      completedChapters: ["intro"],
      completedStepIds: ["welcome"],
      skippedRequiredStepIds: ["other-step"],
      activeChapterId: "output",
      activeStepIndex: 0,
      practiceChartId: "practice-v3",
      paused: true,
    });
    expect(readTutorialProgress()).toEqual(migrated);
  });
});
