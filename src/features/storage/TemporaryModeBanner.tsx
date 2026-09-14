import { useEffect } from "react";
import { useBackupStatus } from "../backup/useBackup";
import { readStorageMode } from "../../storage/storageMode";

/**
 * 「今回だけ使う」で利用中であることを常時示し、
 * 書き出さないまま閉じようとしたときに引き止める。
 */
export default function TemporaryModeBanner() {
  const status = useBackupStatus();
  const temporary = readStorageMode() === "session";
  // 一時モードではメモリ上にしか無いため、書き出し済みでも「その後の編集」は失われる。
  // 相関図が1件でもあれば引き止める (beforeunload は再読み込みでも発火する)。
  const unsaved = temporary && (status.data?.chartCount ?? 0) > 0;

  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  if (!temporary) return null;

  return (
    <div className="temporary-banner" role="status">
      一時利用モードです。このタブを閉じるか再読み込みすると、作成した内容は消えます。
    </div>
  );
}
