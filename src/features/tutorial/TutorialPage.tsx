import { useState } from "react";
import { Check, Clock, Play, RotateCcw, Trash2 } from "lucide-react";
import { Notice, Shell } from "../../components/ui";
import { requiredStepIds, tutorialChapters } from "./tutorialModel";
import { useTutorial } from "./tutorialContext";

export default function TutorialPage() {
  const { progress, startChapter, deletePracticeChart, keepPracticeChart } =
    useTutorial();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const completed = progress?.completedChapters ?? [];
  const allCompleted = completed.length === tutorialChapters.length;

  return (
    <Shell>
      <main className="page tutorial-page">
        <div className="page-head">
          <div>
            <span className="eyebrow">GUIDED PRACTICE</span>
            <h1>チュートリアル</h1>
            <p>
              好きな章から練習できます。途中で終了して通常使用に戻り、同じ章の続きから再開できます。
            </p>
          </div>
        </div>

        {allCompleted && (
          <Notice tone="success">
            すべての章が完了しました。必要な章はいつでも復習できます。
          </Notice>
        )}
        {progress?.upgradedFromV2 && !allCompleted && (
          <Notice tone="info">
            チュートリアルが更新されました。相関図作成をより詳しく練習できる5章構成です。
          </Notice>
        )}

        <div className="tutorial-chapter-grid">
          {tutorialChapters.map((chapter, index) => {
            const isComplete = completed.includes(chapter.id);
            const isActive = progress?.activeChapterId === chapter.id;
            const hasUnmastered = requiredStepIds(chapter).some((stepId) =>
              progress?.skippedRequiredStepIds.includes(stepId),
            );
            const recommended =
              !isComplete &&
              tutorialChapters.find((item) => !completed.includes(item.id))
                ?.id === chapter.id;
            return (
              <article
                className={`tutorial-chapter-card ${recommended ? "recommended" : ""}`}
                key={chapter.id}
              >
                <div className="tutorial-chapter-number">第{index + 1}章</div>
                <h2>{chapter.title}</h2>
                <p>{chapter.summary}</p>
                <p className="tutorial-chapter-time">
                  <Clock size={15} aria-hidden="true" /> 目安 {chapter.minutes}
                  分
                </p>
                <div className="tutorial-chapter-footer">
                  <span
                    className={`tutorial-status ${isComplete && !isActive ? "complete" : ""}`}
                  >
                    {isActive ? (
                      "途中"
                    ) : hasUnmastered ? (
                      "未習得あり"
                    ) : isComplete ? (
                      <>
                        <Check size={15} aria-hidden="true" /> 完了
                      </>
                    ) : (
                      "未開始"
                    )}
                  </span>
                  <button
                    type="button"
                    className={`button ${isActive ? "primary" : ""}`}
                    onClick={() => void startChapter(chapter.id)}
                  >
                    {isComplete && !isActive ? (
                      <RotateCcw size={16} aria-hidden="true" />
                    ) : (
                      <Play size={16} aria-hidden="true" />
                    )}
                    {isActive
                      ? "再開"
                      : isComplete
                        ? "もう一度"
                        : recommended
                          ? "次に進む"
                          : "開始"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {allCompleted &&
          progress?.practiceChartId &&
          !progress.practiceChartKept && (
            <section className="tutorial-practice-cleanup">
              <h2>練習用相関図をどうしますか？</h2>
              <p>
                復習用に残すか、相関図一覧から削除するかを選択してください。
              </p>
              {error && <Notice tone="error">{error}</Notice>}
              <div className="backup-actions">
                <button
                  type="button"
                  className="button"
                  onClick={keepPracticeChart}
                >
                  復習用に残す
                </button>
                <button
                  type="button"
                  className="button danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await deletePracticeChart();
                    } catch (caught) {
                      setError(
                        caught instanceof Error
                          ? `練習用相関図を削除できませんでした。${caught.message}`
                          : "練習用相関図を削除できませんでした。",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  {busy ? "削除中…" : "練習用相関図を削除"}
                </button>
              </div>
            </section>
          )}
      </main>
    </Shell>
  );
}
