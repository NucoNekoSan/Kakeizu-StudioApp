import { DatabaseBackup } from "lucide-react";
import { useBackup } from "./useBackup";

export default function BackupExportButton() {
  const { busy, error, message, exportBackup } = useBackup();

  return (
    <>
      <button
        type="button"
        className="button header-action"
        onClick={() => void exportBackup()}
        disabled={busy !== null}
        aria-label="全データをバックアップ"
        data-tooltip="バックアップ"
      >
        <DatabaseBackup size={17} aria-hidden="true" />
        <span className="button-label">
          {busy === "export" ? "保存中…" : "バックアップ"}
        </span>
      </button>
      {message && (
        <div className="header-toast" role="status" aria-live="polite">
          {message}
        </div>
      )}
      {error && (
        <div className="header-toast" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
