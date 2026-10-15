import { useBackupStatus } from "../backup/useBackup";
import { useStorageState } from "./useStorageState";

/**
 * 「今回だけ使う」で利用中であることを常時示し、
 * 書き出さないまま閉じようとしたときに引き止める。
 */
export default function TemporaryModeBanner() {
  const { mode, fallback: isFallback } = useStorageState();
  useBackupStatus(mode !== null);
  const temporary = mode === "session";
  // backupStatus の解決時にストアも確定し、クエリの再描画で退避状態を拾う。
  const fallback = !temporary && isFallback;

  if (fallback)
    return (
      <div className="temporary-banner fallback-warning" role="alert">
        この端末に保存する設定ですが、ブラウザのストレージが利用できません。現在の内容はタブを閉じるか再読み込みすると失われます。JSONバックアップを書き出してから、ブラウザのストレージ設定をご確認ください。
      </div>
    );

  if (!temporary) return null;

  return (
    <div className="temporary-banner" role="status">
      一時利用モードです。このタブを閉じるか再読み込みすると、作成した内容は消えます。
    </div>
  );
}
