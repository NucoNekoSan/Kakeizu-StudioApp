import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";
import { api } from "../../api";
import { Modal, Notice } from "../../components/ui";
import { getErrorMessage } from "../../domain";
import type { ImportMode } from "../../storage/backupModel";
import { readTextFile } from "../../storage/fileIo";

type PendingFile = { fileName: string; raw: string; encrypted: boolean };

export default function BackupImportControl() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const clearSelection = () => {
    setPending(null);
    setMode("merge");
    setPassphrase("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const importFile = async () => {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.importBackup(
        pending.raw,
        mode,
        pending.encrypted ? passphrase : undefined,
      );
      await queryClient.invalidateQueries();
      const success =
        result.mode === "replace"
          ? `${result.importedCharts}件の相関図で置き換えました。`
          : `${result.importedCharts}件の相関図を追加しました。${
              result.renamedCharts
                ? `（うち${result.renamedCharts}件は複製として追加）`
                : ""
            }`;
      clearSelection();
      setMessage(success);
      if (result.mode === "replace") navigate("/charts");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="button header-action"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="バックアップファイルを読み込む"
      >
        <Upload size={17} aria-hidden="true" />
        <span className="button-label">ファイル読み込み</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setError("");
          try {
            const raw = await readTextFile(file);
            const encrypted = await api.isEncryptedFile(raw).catch(() => false);
            setPending({ fileName: file.name, raw, encrypted });
          } catch (caught) {
            setMessage(getErrorMessage(caught));
            event.currentTarget.value = "";
          }
        }}
      />
      {message && (
        <div className="header-toast" role="status" aria-live="polite">
          {message}
        </div>
      )}
      {pending && (
        <Modal title="バックアップを読み込む" onClose={clearSelection}>
          <div className="modal-body">
            <p className="muted">{pending.fileName}</p>
            <label className="check">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "merge"}
                onChange={() => setMode("merge")}
              />
              追加する（今あるデータは残ります）
            </label>
            <label className="check">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
              />
              置き換える（今あるデータはすべて消えます）
            </label>
            {mode === "replace" && (
              <Notice tone="error">
                この端末に保存されている相関図と表示設定はすべて削除され、ファイルの内容に置き換わります。
              </Notice>
            )}
            {pending.encrypted && (
              <label>
                パスフレーズ
                <input
                  type="password"
                  autoComplete="off"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                />
              </label>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            <div className="modal-actions">
              <button type="button" className="button" onClick={clearSelection}>
                キャンセル
              </button>
              <button
                type="button"
                className="button primary"
                disabled={busy || (pending.encrypted && !passphrase)}
                onClick={() => void importFile()}
              >
                {busy ? "読み込んでいます…" : "読み込む"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
