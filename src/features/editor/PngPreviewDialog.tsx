import { useEffect, useRef } from "react";
import type { PngPreview } from "./usePngExport";

interface Props {
  preview: PngPreview | null;
  isSaving: boolean;
  error: string;
  onClose(): void;
  onSave(): Promise<void>;
}
export function PngPreviewDialog({
  preview,
  isSaving,
  error,
  onClose,
  onSave,
}: Props) {
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
        if (!isSaving) onClose();
      }}
    >
      <h2 id="png-preview-title">PNGプレビュー</h2>
      {preview && (
        <>
          <p>
            {preview.width} × {preview.height}px ·
            保存する画像を縮小表示しています。
          </p>
          <div className="png-preview-image">
            <img
              src={preview.dataUrl}
              alt="保存する相関図のPNGプレビュー"
              width={preview.width}
              height={preview.height}
            />
          </div>
          <p>PNGには入力した氏名やメモが含まれます。</p>
          {error && <p role="alert">{error}</p>}
          <div className="frame-width-actions">
            <button className="button" disabled={isSaving} onClick={onClose}>
              編集に戻る
            </button>
            <button
              className="button primary"
              disabled={isSaving}
              onClick={onSave}
            >
              {isSaving ? "保存中…" : "このPNGを保存"}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
