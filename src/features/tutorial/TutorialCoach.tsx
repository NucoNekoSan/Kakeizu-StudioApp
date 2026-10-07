import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { chapterById } from "./tutorialModel";
import { useTutorial } from "./tutorialContext";

type TargetRect = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

export default function TutorialCoach() {
  const { progress, nextStep, previousStep, skipStep, pause, reportAction } =
    useTutorial();
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [simulationReady, setSimulationReady] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const location = useLocation();
  const chapter =
    progress?.activeChapterId && !progress.paused
      ? chapterById(progress.activeChapterId)
      : null;
  const step = chapter?.steps[progress?.activeStepIndex ?? 0];

  useEffect(() => setSimulationReady(false), [step?.id]);

  useLayoutEffect(() => {
    if (!step) return;
    setTargetMissing(false);
    let timeout = 0;
    const update = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-tutorial-target="${step.target}"]`,
      );
      if (!target) {
        setRect(null);
        return;
      }
      target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      const next = target.getBoundingClientRect();
      const nextRect = {
        top: Math.max(8, next.top - 6),
        left: Math.max(8, next.left - 6),
        width: Math.max(24, next.width + 12),
        height: Math.max(24, next.height + 12),
      };
      setRect((current) =>
        current &&
        current.top === nextRect.top &&
        current.left === nextRect.left &&
        current.width === nextRect.width &&
        current.height === nextRect.height
          ? current
          : nextRect,
      );
      setTargetMissing(false);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    timeout = window.setTimeout(() => {
      if (!document.querySelector(`[data-tutorial-target="${step.target}"]`))
        setTargetMissing(true);
    }, 1200);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.clearTimeout(timeout);
    };
  }, [step]);

  useEffect(() => {
    if (!step) return;
    cardRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      pause();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pause, step]);

  if (!chapter || !step || !progress || location.pathname === "/tutorial")
    return null;
  const isFirst = progress.activeStepIndex === 0;
  const isLast = progress.activeStepIndex === chapter.steps.length - 1;
  const style = rect
    ? ({
        "--tutorial-target-top": `${rect.top}px`,
        "--tutorial-target-left": `${rect.left}px`,
        "--tutorial-target-width": `${rect.width}px`,
        "--tutorial-target-height": `${rect.height}px`,
      } as React.CSSProperties)
    : undefined;
  const placement = rect
    ? `${rect.left > window.innerWidth / 2 ? "left" : "right"} ${rect.top > window.innerHeight / 2 ? "top" : "bottom"}`
    : "right bottom";

  return (
    <div className="tutorial-coach-layer" style={style}>
      {rect && <div className="tutorial-coach-spotlight" aria-hidden="true" />}
      <section
        ref={cardRef}
        className={`tutorial-coach-card ${placement}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="tutorial-coach-meta" aria-live="polite">
          {chapter.title} · {progress.activeStepIndex + 1} /{" "}
          {chapter.steps.length}
        </div>
        <button
          type="button"
          className="icon tutorial-coach-close"
          onClick={pause}
          aria-label="チュートリアルを終了して通常使用"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id={titleId}>{step.title}</h2>
        <p>{step.body}</p>
        <p className="tutorial-step-kind">
          {step.kind === "action"
            ? "実操作"
            : step.kind === "simulation"
              ? "安全な模擬操作"
              : "説明"}
          {step.required ? " · 必須" : ""}
        </p>
        {step.kind === "simulation" && (
          <div
            className="tutorial-simulation"
            aria-label="保存されない練習操作"
          >
            <strong>練習中・この内容は保存されません</strong>
            {step.id === "settings-simulation" && (
              <>
                <label>
                  続柄の線
                  <select
                    onChange={() => setSimulationReady(true)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      選択
                    </option>
                    <option>実線</option>
                    <option>点線</option>
                  </select>
                </label>
                <label>
                  性別の色
                  <input
                    type="color"
                    defaultValue="#276653"
                    onChange={() => setSimulationReady(true)}
                  />
                </label>
              </>
            )}
            {step.id === "import-simulation" && (
              <label>
                読み込み方法
                <select
                  onChange={() => setSimulationReady(true)}
                  defaultValue=""
                >
                  <option value="" disabled>
                    選択
                  </option>
                  <option>現在のデータへ追加</option>
                  <option>現在のデータを置き換え</option>
                </select>
              </label>
            )}
            {step.id === "storage-simulation" && (
              <label>
                <input
                  type="checkbox"
                  onChange={(event) => setSimulationReady(event.target.checked)}
                />{" "}
                全削除は元に戻せないことを確認しました
              </label>
            )}
            <button
              type="button"
              className="button primary"
              disabled={!simulationReady}
              onClick={() => reportAction("simulation-completed")}
            >
              {step.simulationLabel ?? "模擬操作を完了"}
            </button>
          </div>
        )}
        {step.action && !targetMissing && (
          <p className="tutorial-coach-task" role="status">
            強調された場所を操作すると自動で次へ進みます。
          </p>
        )}
        {targetMissing && (
          <p className="tutorial-coach-warning" role="alert">
            案内対象を表示できません。画面を再読み込みするか、このステップをスキップしてください。
          </p>
        )}
        <div className="tutorial-coach-actions">
          {targetMissing && (
            <button
              type="button"
              className="button"
              onClick={() => window.location.reload()}
            >
              再試行
            </button>
          )}
          <button
            type="button"
            className="button"
            onClick={previousStep}
            disabled={isFirst}
          >
            <ArrowLeft size={16} aria-hidden="true" /> 戻る
          </button>
          <button type="button" className="button" onClick={skipStep}>
            {step.required ? "未習得としてスキップ" : "スキップ"}
          </button>
          {!step.action && (
            <button type="button" className="button primary" onClick={nextStep}>
              {isLast ? "章を完了" : "次へ"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="button compact" onClick={pause}>
            チュートリアルを終了して通常使用
          </button>
        </div>
      </section>
    </div>
  );
}
