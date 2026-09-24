import { useRef, useState } from "react";
import { Scan } from "lucide-react";
import { isFrameHeight, isFrameWidth } from "../../frameSettings";
interface Props {
  visible: boolean;
  width: number;
  height: number;
  isSaving: boolean;
  error: string;
  willMove(width: number, height: number): boolean;
  onApply(visible: boolean, width: number, height: number): Promise<void>;
}
export function FrameSettings({
  visible,
  width,
  height,
  isSaving,
  error,
  willMove,
  onApply,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draftVisible, setDraftVisible] = useState(visible);
  const [draftWidth, setDraftWidth] = useState(String(width));
  const [draftHeight, setDraftHeight] = useState(String(height));
  const nextWidth = Number(draftWidth);
  const nextHeight = Number(draftHeight);
  const validWidth = draftWidth.trim() !== "" && isFrameWidth(nextWidth);
  const validHeight = draftHeight.trim() !== "" && isFrameHeight(nextHeight);
  const valid = validWidth && validHeight;
  return (
    <>
      <button
        className="button"
        aria-label="外枠"
        data-tooltip="外枠とPNGサイズ"
        aria-haspopup="dialog"
        onClick={() => {
          setDraftVisible(visible);
          setDraftWidth(String(width));
          setDraftHeight(String(height));
          dialog.current?.showModal();
        }}
      >
        <Scan size={17} aria-hidden="true" />
        <span className="button-label">外枠</span>
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
              await onApply(draftVisible, nextWidth, nextHeight);
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
              aria-label="横幅を100px減らす"
              disabled={isSaving || !validWidth || nextWidth <= 1200}
              onClick={() =>
                setDraftWidth(String(Math.max(1200, nextWidth - 100)))
              }
            >
              −100px
            </button>
            <button
              type="button"
              aria-label="横幅を100px増やす"
              disabled={isSaving || !validWidth || nextWidth >= 4800}
              onClick={() =>
                setDraftWidth(String(Math.min(4800, nextWidth + 100)))
              }
            >
              ＋100px
            </button>
          </div>
          <p>横幅は1200〜4800pxの整数。</p>
          {!validWidth && (
            <p role="alert">横幅は1200〜4800pxの整数で指定してください。</p>
          )}
          <label>
            PNGの縦幅（px）
            <input
              type="number"
              min={600}
              max={4800}
              step="any"
              value={draftHeight}
              disabled={isSaving}
              onChange={(event) => setDraftHeight(event.target.value)}
            />
          </label>
          <div className="frame-width-actions">
            <button
              type="button"
              aria-label="縦幅を100px減らす"
              disabled={isSaving || !validHeight || nextHeight <= 600}
              onClick={() =>
                setDraftHeight(String(Math.max(600, nextHeight - 100)))
              }
            >
              −100px
            </button>
            <button
              type="button"
              aria-label="縦幅を100px増やす"
              disabled={isSaving || !validHeight || nextHeight >= 4800}
              onClick={() =>
                setDraftHeight(String(Math.min(4800, nextHeight + 100)))
              }
            >
              ＋100px
            </button>
          </div>
          <p>縦幅は600〜4800pxの整数。縦横比は自由に変更できます。</p>
          {!validHeight && (
            <p role="alert">縦幅は600〜4800pxの整数で指定してください。</p>
          )}
          {valid &&
            (nextWidth < width || nextHeight < height) &&
            willMove(nextWidth, nextHeight) && (
              <p role="status">
                人物を内側へ移動します。重なる場合があります。
              </p>
            )}
          {error && <p role="alert">{error}</p>}
          <div className="frame-width-actions frame-dialog-actions">
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
