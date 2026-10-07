import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { Modal, Notice } from "../../components/ui";
import {
  chapterById,
  emptyTutorialProgress,
  requiredStepIds,
  routeForStep,
  TUTORIAL_LATER_KEY,
  type TutorialAction,
  type TutorialChapterId,
  type TutorialProgress,
} from "./tutorialModel";
import { readTutorialProgress, writeTutorialProgress } from "./tutorialStorage";
import TutorialCoach from "./TutorialCoach";
import { TutorialContext, type TutorialContextValue } from "./tutorialContext";

const promptWasDeferred = () => {
  try {
    return sessionStorage.getItem(TUTORIAL_LATER_KEY) === "true";
  } catch {
    return false;
  }
};

export default function TutorialProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [progress, setProgress] = useState<TutorialProgress | null>(
    readTutorialProgress,
  );
  const [promptOpen, setPromptOpen] = useState(false);
  const [upgradeNoticeOpen, setUpgradeNoticeOpen] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pendingSteps = useRef<Set<number>>(new Set());
  const operationVersion = useRef(0);

  const clearPendingSteps = useCallback(() => {
    for (const timeout of pendingSteps.current) window.clearTimeout(timeout);
    pendingSteps.current.clear();
  }, []);

  useEffect(() => clearPendingSteps, [clearPendingSteps]);

  const scheduleStep = useCallback((advance: () => void) => {
    const timeout = window.setTimeout(() => {
      pendingSteps.current.delete(timeout);
      advance();
    }, 250);
    pendingSteps.current.add(timeout);
  }, []);

  const updateProgress = useCallback(
    (update: (current: TutorialProgress) => TutorialProgress) => {
      setProgress((current) => {
        const next = update(current ?? emptyTutorialProgress());
        writeTutorialProgress(next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (location.pathname === "/charts" && !progress && !promptWasDeferred())
      setPromptOpen(true);
  }, [location.pathname, progress]);

  const ensurePracticeChart = useCallback(async () => {
    if (progress?.practiceChartId) {
      try {
        await api.chart(progress.practiceChartId);
        return progress.practiceChartId;
      } catch {
        // 削除済みなら作り直す。
      }
    }
    const chart = await api.createChart("練習用相関図");
    await queryClient.invalidateQueries({ queryKey: ["charts"] });
    updateProgress((current) => ({
      ...current,
      practiceChartId: chart.id,
      practiceChartKept: false,
    }));
    return chart.id;
  }, [progress?.practiceChartId, queryClient, updateProgress]);

  const startChapter = useCallback(
    async (id: TutorialChapterId) => {
      setError("");
      clearPendingSteps();
      const operation = ++operationVersion.current;
      try {
        const practiceChartId =
          id === "family" || id === "layout" || id === "output"
            ? await ensurePracticeChart()
            : (progress?.practiceChartId ?? null);
        if (operation !== operationVersion.current) return;
        const chapter = chapterById(id);
        const isResuming = progress?.activeChapterId === id;
        const stepIndex = isResuming ? progress.activeStepIndex : 0;
        updateProgress((current) => {
          const isReplay =
            current.completedChapters.includes(id) && !isResuming;
          const stepIds = new Set(chapter.steps.map((step) => step.id));
          return {
            ...current,
            completedChapters: isReplay
              ? current.completedChapters.filter(
                  (chapterId) => chapterId !== id,
                )
              : current.completedChapters,
            completedStepIds: isReplay
              ? current.completedStepIds.filter(
                  (stepId) => !stepIds.has(stepId),
                )
              : current.completedStepIds,
            skippedRequiredStepIds: isReplay
              ? current.skippedRequiredStepIds.filter(
                  (stepId) => !stepIds.has(stepId),
                )
              : current.skippedRequiredStepIds,
            activeChapterId: id,
            activeStepIndex: stepIndex,
            paused: false,
            practiceChartId: practiceChartId ?? current.practiceChartId,
          };
        });
        navigate(routeForStep(chapter.steps[stepIndex], practiceChartId));
      } catch (caught) {
        if (operation !== operationVersion.current) return;
        setError(
          caught instanceof Error
            ? `チュートリアルを開始できませんでした。${caught.message}`
            : "チュートリアルを開始できませんでした。",
        );
        navigate("/tutorial");
      }
    },
    [
      clearPendingSteps,
      ensurePracticeChart,
      navigate,
      progress?.activeChapterId,
      progress?.activeStepIndex,
      progress?.practiceChartId,
      updateProgress,
    ],
  );

  const moveToStep = useCallback(
    (stepIndex: number, outcome?: "completed" | "skipped") => {
      if (!progress?.activeChapterId || progress.paused) return;
      const chapter = chapterById(progress.activeChapterId);
      const currentStep = chapter.steps[progress.activeStepIndex];
      const completedStepIds = new Set(progress.completedStepIds);
      const skippedStepIds = new Set(progress.skippedRequiredStepIds);
      if (outcome === "completed") {
        completedStepIds.add(currentStep.id);
        skippedStepIds.delete(currentStep.id);
      } else if (outcome === "skipped" && currentStep.required) {
        completedStepIds.delete(currentStep.id);
        skippedStepIds.add(currentStep.id);
      }
      if (stepIndex >= chapter.steps.length) {
        const mastered = requiredStepIds(chapter).every((id) =>
          completedStepIds.has(id),
        );
        const completed = mastered
          ? Array.from(new Set([...progress.completedChapters, chapter.id]))
          : progress.completedChapters.filter((id) => id !== chapter.id);
        updateProgress((current) => ({
          ...current,
          completedChapters: completed,
          completedStepIds: [...completedStepIds],
          skippedRequiredStepIds: [...skippedStepIds],
          activeChapterId: null,
          activeStepIndex: 0,
          paused: false,
        }));
        navigate("/tutorial");
        return;
      }
      const index = Math.max(0, stepIndex);
      updateProgress((current) => ({
        ...current,
        activeStepIndex: index,
        completedStepIds: [...completedStepIds],
        skippedRequiredStepIds: [...skippedStepIds],
      }));
      navigate(routeForStep(chapter.steps[index], progress.practiceChartId));
    },
    [navigate, progress, updateProgress],
  );

  const nextStep = useCallback(
    () => moveToStep((progress?.activeStepIndex ?? 0) + 1, "completed"),
    [moveToStep, progress?.activeStepIndex],
  );
  const previousStep = useCallback(
    () => moveToStep((progress?.activeStepIndex ?? 0) - 1),
    [moveToStep, progress?.activeStepIndex],
  );
  const skipStep = useCallback(() => {
    if (!progress?.activeChapterId || progress.paused) return;
    const chapter = chapterById(progress.activeChapterId);
    const step = chapter.steps[progress.activeStepIndex];
    if (step.action !== "chart-created" || progress.practiceChartId) {
      moveToStep(progress.activeStepIndex + 1, "skipped");
      return;
    }
    const operation = operationVersion.current;
    void ensurePracticeChart()
      .then((chartId) => {
        if (operation !== operationVersion.current) return;
        const nextIndex = progress.activeStepIndex + 1;
        updateProgress((current) => ({
          ...current,
          activeStepIndex: nextIndex,
          practiceChartId: chartId,
          skippedRequiredStepIds: Array.from(
            new Set([...current.skippedRequiredStepIds, step.id]),
          ),
        }));
        navigate(routeForStep(chapter.steps[nextIndex], chartId));
      })
      .catch((caught) => {
        if (operation !== operationVersion.current) return;
        setError(
          caught instanceof Error
            ? `練習用相関図を作成できませんでした。${caught.message}`
            : "練習用相関図を作成できませんでした。",
        );
        navigate("/tutorial");
      });
  }, [ensurePracticeChart, moveToStep, navigate, progress, updateProgress]);
  const pause = useCallback(() => {
    ++operationVersion.current;
    clearPendingSteps();
    updateProgress((current) => ({ ...current, paused: true }));
    navigate("/charts");
  }, [clearPendingSteps, navigate, updateProgress]);

  const reportAction = useCallback(
    (action: TutorialAction, chartId?: string) => {
      if (!progress?.activeChapterId || progress.paused) return;
      const chapter = chapterById(progress.activeChapterId);
      const step = chapter.steps[progress.activeStepIndex];
      if (step.action !== action) return;
      if (
        action !== "chart-created" &&
        action !== "simulation-completed" &&
        chartId !== progress.practiceChartId
      )
        return;
      if (action === "chart-created" && chartId) {
        const nextIndex = progress.activeStepIndex + 1;
        updateProgress((current) => ({
          ...current,
          practiceChartId: chartId,
          practiceChartKept: false,
          activeStepIndex: nextIndex,
          completedStepIds: Array.from(
            new Set([...current.completedStepIds, step.id]),
          ),
          skippedRequiredStepIds: current.skippedRequiredStepIds.filter(
            (id) => id !== step.id,
          ),
        }));
        scheduleStep(() =>
          navigate(routeForStep(chapter.steps[nextIndex], chartId)),
        );
        return;
      }
      scheduleStep(() => moveToStep(progress.activeStepIndex + 1, "completed"));
    },
    [moveToStep, navigate, progress, scheduleStep, updateProgress],
  );

  const deletePracticeChart = useCallback(async () => {
    if (!progress?.practiceChartId) return;
    await api.deleteChart(progress.practiceChartId);
    await queryClient.invalidateQueries({ queryKey: ["charts"] });
    updateProgress((current) => ({
      ...current,
      practiceChartId: null,
      practiceChartKept: false,
    }));
  }, [progress?.practiceChartId, queryClient, updateProgress]);
  const keepPracticeChart = useCallback(
    () =>
      updateProgress((current) => ({
        ...current,
        practiceChartKept: true,
      })),
    [updateProgress],
  );

  const value = useMemo<TutorialContextValue>(
    () => ({
      progress,
      startChapter,
      reportAction,
      nextStep,
      previousStep,
      skipStep,
      pause,
      deletePracticeChart,
      keepPracticeChart,
    }),
    [
      deletePracticeChart,
      keepPracticeChart,
      nextStep,
      pause,
      previousStep,
      progress,
      reportAction,
      skipStep,
      startChapter,
    ],
  );

  const beginFromPrompt = () => {
    setPromptOpen(false);
    updateProgress((current) => ({ ...current, promptDisabled: false }));
    navigate("/tutorial");
  };
  const deferPrompt = () => {
    try {
      sessionStorage.setItem(TUTORIAL_LATER_KEY, "true");
    } catch {
      // 保存できない場合も、現在の表示は閉じられるようにする。
    }
    setPromptOpen(false);
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {error && (
        <div className="tutorial-global-error">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {upgradeNoticeOpen &&
        location.pathname === "/charts" &&
        progress?.upgradedFromV2 &&
        !progress.promptDisabled && (
          <div className="tutorial-global-error">
            <Notice tone="info">
              チュートリアルが5章構成に更新されました。相関図作成をより詳しく練習できます。{" "}
              <button
                type="button"
                className="button compact"
                onClick={() => navigate("/tutorial")}
              >
                内容を見る
              </button>{" "}
              <button
                type="button"
                className="button compact"
                onClick={() => setUpgradeNoticeOpen(false)}
              >
                閉じる
              </button>
            </Notice>
          </div>
        )}
      <TutorialCoach />
      {promptOpen && (
        <Modal
          title="Kakeizu Studio の使い方を練習しますか？"
          onClose={deferPrompt}
        >
          <div className="modal-body">
            <p>
              練習用の相関図を使い、作成からバックアップまでを5章・約20分で確認できます。好きな章を選べて、途中で通常使用に戻っても続きから再開できます。
            </p>
            <div className="modal-actions tutorial-prompt-actions">
              <button type="button" className="button" onClick={deferPrompt}>
                後で
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  updateProgress((current) => ({
                    ...current,
                    promptDisabled: true,
                  }));
                  setPromptOpen(false);
                }}
              >
                今後表示しない
              </button>
              <button
                type="button"
                className="button primary"
                onClick={beginFromPrompt}
              >
                チュートリアルを始める
              </button>
            </div>
          </div>
        </Modal>
      )}
    </TutorialContext.Provider>
  );
}
