import { useEffect, useRef, useState } from "react";
import { exportFormats, type ExportFormat } from "./exportFormats";

interface Props {
  open: boolean;
  isSaving: boolean;
  error: string;
  onClose(): void;
  onSave(format: ExportFormat): Promise<void>;
}

export function ExportFileDialog({
  open,
  isSaving,
  error,
  onClose,
  onSave,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<ExportFormat>("transparent-png");
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="png-preview-dialog export-file-dialog"
      aria-labelledby="file-export-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!isSaving) onClose();
      }}
    >
      <h2 id="file-export-title">ファイル書き出し</h2>
      <p>保存する形式を選んでください。氏名やメモもファイルに含まれます。</p>
      <label>
        形式
        <select
          value={format}
          disabled={isSaving}
          onChange={(event) => setFormat(event.target.value as ExportFormat)}
        >
          {exportFormats.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <p>
        対応ブラウザでは保存場所を選べます。それ以外では通常のダウンロードになります。
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="frame-width-actions">
        <button
          type="button"
          className="button"
          disabled={isSaving}
          onClick={onClose}
        >
          キャンセル
        </button>
        <button
          type="button"
          className="button primary"
          disabled={isSaving}
          onClick={() => void onSave(format)}
        >
          {isSaving ? "保存中…" : "保存先を選んで書き出す"}
        </button>
      </div>
    </dialog>
  );
}
