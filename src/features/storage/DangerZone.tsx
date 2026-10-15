import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal, Notice } from "../../components/ui";
import { getErrorMessage } from "../../domain";
import { clearBrowserData } from "../../storage/localApi";
import { readStorageMode } from "../../storage/storageMode";
import { useBackup, useBackupStatus } from "../backup/useBackup";

/**
 * この端末に残るデータの消去。
 *
 * 共有 PC ではログアウトに相当する操作が無いため、明示的な削除手段を置く。
 * 取り返しがつかないので、確認ダイアログの中から直接書き出せるようにしている。
 */
export default function DangerZone() {
  const status = useBackupStatus();
  const { exportBackup, busy } = useBackup();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const chartCount = status.data?.chartCount ?? 0;

  const remove = async () => {
    if (deleting) return;
    setError("");
    setBlocked(false);
    setDeleting(true);
    try {
      await clearBrowserData({ onBlocked: () => setBlocked(true) });
      setConfirming(false);
      setDone(true);
      // StorageResetBoundary が全タブの画面とキャッシュを破棄する。
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="danger-zone">
      <h3>この端末のデータを削除</h3>
      <p>
        この端末のブラウザに保存されている相関図と表示設定をすべて消します。共有の端末を使い終えたときにお使いください。元に戻すことはできません。
      </p>
      {readStorageMode() === "session" && (
        <p className="muted">
          現在は一時利用モードです。タブを閉じれば同じ状態になります。
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="success">削除しました。</Notice>}
      <button
        type="button"
        className="button danger"
        onClick={() => setConfirming(true)}
        disabled={deleting}
      >
        <Trash2 size={17} aria-hidden="true" />
        この端末のデータをすべて削除
      </button>

      {confirming && (
        <Modal
          title="本当に削除しますか"
          onClose={() => {
            if (!deleting) setConfirming(false);
          }}
        >
          <div className="modal-body">
            <Notice tone="error">
              相関図 {chartCount}{" "}
              件と、続柄・性別の設定をすべて削除します。元に戻せません。
            </Notice>
            <p>必要な場合は、削除する前に書き出して保管してください。</p>
            {blocked && (
              <Notice tone="info">
                削除を保留しています。他のタブを閉じると自動的に完了します。削除処理は取り消せません。
              </Notice>
            )}
            <button
              type="button"
              className="button"
              onClick={() => void exportBackup()}
              disabled={busy !== null || deleting}
            >
              {busy === "export" ? "書き出しています…" : "削除する前に書き出す"}
            </button>
            <div className="modal-actions">
              <button
                type="button"
                className="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="button danger"
                onClick={remove}
                disabled={deleting}
              >
                {deleting ? "削除の完了を待っています…" : "すべて削除する"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
