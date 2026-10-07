import { useEffect, useRef } from "react";
import type { PngPreview } from "./usePngExport";

interface Props {
  preview: PngPreview | null;
  error: string;
  onClose(): void;
}
export function PngPreviewDialog({ preview, error, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (preview && !dialog.current?.open) dialog.current?.showModal();
    else if (!preview && dialog.current?.open) dialog.current.close();
  }, [preview]);
  return (
    <dialog
      ref={dialog}
      className="png-preview-dialog"
      aria-labelledby="png-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id="png-preview-title">全体プレビュー</h2>
      {preview && (
        <>
          <p>
            {preview.width} × {preview.height}px ·
            相関図全体を縮小表示しています。
          </p>
          <div className="png-preview-image">
            <img
              src={preview.dataUrl}
              alt="相関図の全体プレビュー"
              width={preview.width}
              height={preview.height}
            />
          </div>
          <p>
            書き出す場合は、編集画面の「ファイル書き出し」から形式を選んでください。
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="frame-width-actions">
            <button className="button" onClick={onClose}>
              編集に戻る
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
