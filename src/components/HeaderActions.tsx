import { BookOpenCheck, CircleHelp, Mail, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import BackupExportButton from "../features/backup/BackupExportButton";
import ChartBackupSelectButton from "../features/backup/ChartBackupSelectButton";

export interface ChartBackupAction {
  readonly isActive: boolean;
  readonly isDisabled: boolean;
  readonly message: string;
  readonly onToggle: () => void;
}

export function GuidanceActions({
  showContact = false,
}: {
  showContact?: boolean;
}) {
  return (
    <div className="header-guidance" data-tutorial-target="resources">
      <Link
        className="button header-action"
        to="/tutorial"
        aria-label="チュートリアル"
        data-tooltip="チュートリアル"
      >
        <BookOpenCheck size={17} aria-hidden="true" />
        <span className="button-label">チュートリアル</span>
      </Link>
      <Link
        className="button header-action"
        to="/help"
        aria-label="ヘルプ"
        data-tooltip="ヘルプを開く"
      >
        <CircleHelp size={17} aria-hidden="true" />
        <span className="button-label">ヘルプ</span>
      </Link>
      {showContact && <ContactAction />}
    </div>
  );
}

function ContactAction() {
  return (
    <a
      className="button header-action"
      href="https://nuconeko-garden.com/contact/?work=kakeizu-studio"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="コンタクト（新しいタブで開く）"
      data-tooltip="コンタクト"
    >
      <Mail size={17} aria-hidden="true" />
      <span className="button-label">コンタクト</span>
    </a>
  );
}

export function ResourceActions({
  showContact = true,
  backupMode = "all",
  chartBackupAction,
}: {
  showContact?: boolean;
  backupMode?: "all" | "chart" | "none";
  chartBackupAction?: ChartBackupAction;
}) {
  return (
    <div className="header-resources">
      {backupMode === "chart" && chartBackupAction ? (
        <ChartBackupSelectButton {...chartBackupAction} />
      ) : backupMode === "all" ? (
        <BackupExportButton />
      ) : null}
      <Link
        className="button header-action"
        to="/file-import"
        aria-label="バックアップファイルを読み込む"
        data-tooltip="ファイル読み込み"
      >
        <Upload size={17} aria-hidden="true" />
        <span className="button-label">ファイル読み込み</span>
      </Link>
      {showContact && <ContactAction />}
    </div>
  );
}
