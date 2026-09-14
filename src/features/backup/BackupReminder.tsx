import { Link } from "react-router-dom";
import { BACKUP_WARNING_DAYS, useBackupStatus } from "./useBackup";

/**
 * 端末内保存では端末故障やサイトデータ削除で全消失するため、
 * バックアップから時間が経っていることに気づける導線を一覧に出す。
 */
export default function BackupReminder() {
  const status = useBackupStatus();
  const data = status.data;
  if (!data || data.chartCount === 0) return null;

  const overdue =
    data.daysSinceExport === null ||
    data.daysSinceExport >= BACKUP_WARNING_DAYS;
  if (!overdue) return null;

  return (
    <div className="backup-reminder" role="status">
      <span>
        {data.lastExportedAt === null
          ? "まだバックアップを書き出していません。端末の故障やブラウザのデータ削除で相関図が失われます。"
          : `前回のバックアップから${data.daysSinceExport}日が経過しています。`}
      </span>
      <Link className="button" to="/settings">
        バックアップを書き出す
      </Link>
    </div>
  );
}
