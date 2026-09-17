import { useRef, useState } from "react";
import { isFrameWidth } from "../../frameSettings";
interface Props {
  visible: boolean;
  width: number;
  isSaving: boolean;
  error: string;
  willMove(width: number): boolean;
  onApply(visible: boolean, width: number): Promise<void>;
}
export function FrameSettings({
  visible,
  width,
  isSaving,
  error,
  willMove,
  onApply,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draftVisible, setDraftVisible] = useState(visible);
  const [draftWidth, setDraftWidth] = useState(String(width));
  const nextWidth = Number(draftWidth);
  const valid = draftWidth.trim() !== "" && isFrameWidth(nextWidth);
  return (
    <>
      <button
        className="button"
        aria-haspopup="dialog"
        onClick={() => {
          setDraftVisible(visible);
          setDraftWidth(String(width));
          dialog.current?.showModal();
        }}
      >
        外枠
      </button>
      <dialog
        ref={dialog}
        className="frame-settings-dialog"
        aria-labelledby="frame-settings-title"
        onCancel={(event) => {
          if (isSaving) event.preventDefault();
        }}
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!valid || isSaving) return;
            try {
              await onApply(draftVisible, nextWidth);
              dialog.current?.close();
            } catch {
              /* 呼び出し元のエラーを表示 */
            }
          }}
        >
          <h2 id="frame-settings-title">外枠</h2>
          <label className="frame-visibility">
            <input
              type="checkbox"
              checked={draftVisible}
              disabled={isSaving}
              onChange={(event) => setDraftVisible(event.target.checked)}
            />
            画面に外枠を表示
          </label>
          <p>非表示にしても配置制限とPNGの点線は残ります。</p>
          <label>
            PNGの横幅（px）
            <input
              type="number"
              min={1200}
              max={4800}
              step="any"
              value={draftWidth}
              disabled={isSaving}
              onChange={(event) => setDraftWidth(event.target.value)}
            />
          </label>
          <div className="frame-width-actions">
            <button
              type="button"
              disabled={isSaving || !valid || nextWidth <= 1200}
              onClick={() =>
                setDraftWidth(String(Math.max(1200, nextWidth - 100)))
              }
            >
              −100px
            </button>
            <button
              type="button"
              disabled={isSaving || !valid || nextWidth >= 4800}
              onClick={() =>
                setDraftWidth(String(Math.min(4800, nextWidth + 100)))
              }
            >
              ＋100px
            </button>
          </div>
          <p>1200〜4800pxの整数。高さは1200pxです。</p>
          {!valid && (
            <p role="alert">横幅は1200〜4800pxの整数で指定してください。</p>
          )}
          {valid && nextWidth < width && willMove(nextWidth) && (
            <p role="status">人物を内側へ移動します。重なる場合があります。</p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="frame-width-actions">
            <button
              type="button"
              className="button"
              disabled={isSaving}
              onClick={() => dialog.current?.close()}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={!valid || isSaving}
            >
              {isSaving ? "保存中…" : "適用"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
