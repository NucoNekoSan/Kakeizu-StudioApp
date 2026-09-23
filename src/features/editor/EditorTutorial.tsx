import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

const steps = [
  {
    target: "editor-basics",
    title: "編集内容は自動で保存されます",
    body: "相関図のタイトルを変更したり人物を編集したりすると、この端末内へ自動保存されます。上部の表示で保存状態を確認できます。",
  },
  {
    target: "add-person",
    title: "人物を追加する",
    body: "左側の追加フォームで、名前・性別・続柄などを入力します。まず基準になる人物から追加しましょう。",
  },
  {
    target: "edit-person",
    title: "人物と家族関係を編集する",
    body: "人物を選ぶと編集タブが使えます。選択中の人物を基準に、配偶者や子などを素早く追加できます。",
  },
  {
    target: "canvas",
    title: "配置と大きさを整える",
    body: "人物カードはドラッグして移動できます。カードを選択して表示されるハンドルから大きさも調整できます。",
  },
  {
    target: "cohabitation",
    title: "同居関係を表す",
    body: "「同居輪」で人物を囲み、「同居文字」で補足を配置できます。もう一度ボタンを押すと通常の編集に戻ります。",
  },
  {
    target: "resources",
    title: "仕上げとデータ管理",
    body: "外枠とPNGで仕上がりを確認できます。バックアップの読み込み、詳しいヘルプ、問い合わせも上部から開けます。",
  },
] as const;

type Rect = { top: number; left: number; width: number; height: number };

export default function EditorTutorial({
  open,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  onClose(): void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-tutorial-target="${steps[index].target}"]`,
      );
      if (!target) return setRect(null);
      const next = target.getBoundingClientRect();
      setRect({
        top: Math.max(8, next.top - 6),
        left: Math.max(8, next.left - 6),
        width: next.width + 12,
        height: next.height + 12,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [index, open]);

  useEffect(() => {
    if (!open) return;
    const root = document.querySelector(".editor-shell");
    const siblings = root
      ? Array.from(root.children).filter(
          (element) => !element.classList.contains("tutorial-layer"),
        )
      : [];
    const returnFocus = returnFocusRef.current;
    siblings.forEach((element) => element.setAttribute("inert", ""));
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      siblings.forEach((element) => element.removeAttribute("inert"));
      returnFocus?.focus();
    };
  }, [onClose, open, returnFocusRef]);

  if (!open) return null;
  const step = steps[index];
  const cardStyle = rect
    ? ({
        "--target-top": `${rect.top}px`,
        "--target-left": `${rect.left}px`,
        "--target-width": `${rect.width}px`,
        "--target-height": `${rect.height}px`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="tutorial-layer" style={cardStyle}>
      <div className="tutorial-shade" aria-hidden="true" />
      {rect && <div className="tutorial-spotlight" aria-hidden="true" />}
      <section
        ref={dialogRef}
        className={`tutorial-card tutorial-step-${index + 1}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="tutorial-progress" aria-live="polite">
          ステップ {index + 1} / {steps.length}
        </div>
        <button
          className="icon tutorial-close"
          onClick={onClose}
          aria-label="チュートリアルを閉じる"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id={titleId}>{step.title}</h2>
        <p>{step.body}</p>
        <div className="tutorial-dots" aria-hidden="true">
          {steps.map((_, dot) => (
            <span key={dot} className={dot === index ? "active" : ""} />
          ))}
        </div>
        <div className="tutorial-actions">
          <button
            className="button"
            disabled={index === 0}
            onClick={() => setIndex((value) => value - 1)}
          >
            <ArrowLeft size={16} aria-hidden="true" /> 戻る
          </button>
          {index === steps.length - 1 ? (
            <button className="button primary" onClick={onClose}>
              終了する
            </button>
          ) : (
            <button
              className="button primary"
              onClick={() => setIndex((value) => value + 1)}
            >
              次へ <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
