import { useEffect, useState } from "react";
import { useBackupStatus } from "../backup/useBackup";
import { readStorageMode } from "../../storage/storageMode";
import { isStorageFallback, localApi } from "../../storage/localApi";

/**
 * 「今回だけ使う」で利用中であることを常時示し、
 * 書き出さないまま閉じようとしたときに引き止める。
 * IndexedDB フォールバック時は専用の警告を出す。
 */
export default function TemporaryModeBanner() {
  const status = useBackupStatus();
  const temporary = readStorageMode() === "session";
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (temporary) return;
    localApi.charts().then(() => {
      if (isStorageFallback()) setFallback(true);
    });
  }, [temporary]);

  const unsaved =
    (temporary || fallback) && (status.data?.chartCount ?? 0) > 0;

  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  if (fallback) {
    return (
      <div className="temporary-banner fallback-warning" role="alert">
        この端末に保存する設定ですが、ブラウザのストレージが利用できません。現在の内容はタブを閉じると失われます。プライベートウィンドウでないか、ストレージの許可設定をご確認ください。
      </div>
    );
  }

  if (!temporary) return null;

  return (
    <div className="temporary-banner" role="status">
      一時利用モードです。このタブを閉じるか再読み込みすると、作成した内容は消えます。
    </div>
  );
}
