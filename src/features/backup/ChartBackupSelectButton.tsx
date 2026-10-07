import { DatabaseBackup } from "lucide-react";

interface ChartBackupSelectButtonProps {
  readonly isActive: boolean;
  readonly isDisabled: boolean;
  readonly message: string;
  readonly onToggle: () => void;
}

export default function ChartBackupSelectButton({
  isActive,
  isDisabled,
  message,
  onToggle,
}: ChartBackupSelectButtonProps) {
  return (
    <>
      <button
        type="button"
        data-tutorial-target="chart-backup"
        className={`button header-action${isActive ? " active" : ""}`}
        onClick={onToggle}
        disabled={isDisabled}
        aria-label={
          isActive
            ? "バックアップする相関図の選択をキャンセル"
            : "相関図を選択してバックアップ"
        }
        aria-pressed={isActive}
        data-tooltip="バックアップ"
      >
        <DatabaseBackup size={17} aria-hidden="true" />
        <span className="button-label">
          {isActive ? "選択中" : "バックアップ"}
        </span>
      </button>
      {message && (
        <div className="header-toast" role="status" aria-live="polite">
          {message}
        </div>
      )}
    </>
  );
}
