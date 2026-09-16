import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Modal, Notice, Spinner } from "../../components/ui";
import { formatDate } from "../../domain";
import type { ImportMode } from "../../storage/backupModel";
import { api } from "../../api";
import DangerZone from "../storage/DangerZone";
import StorageModeSection from "../storage/StorageModeSection";
import { useBackup, useBackupStatus } from "./useBackup";

function ImportConfirm({
  fileName,
  encrypted,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  encrypted: boolean;
  onCancel(): void;
  onConfirm(mode: ImportMode, passphrase?: string): void;
}) {
  const [mode, setMode] = useState<ImportMode>("merge");
  const [passphrase, setPassphrase] = useState("");
  return (
    <Modal title="バックアップを読み込む" onClose={onCancel}>
      <div className="modal-body">
        <p className="muted">{fileName}</p>
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
            この端末に保存されている相関図と表示設定はすべて削除され、ファイルの内容に置き換わります。必要な場合は先に書き出してください。
          </Notice>
        )}
        {encrypted && (
          <label>
            パスフレーズ
            <input
              type="password"
              autoComplete="off"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="書き出したときのパスフレーズ"
            />
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onCancel}>
            キャンセル
          </button>
          <button
            type="button"
            className="button primary"
            disabled={encrypted && !passphrase}
            onClick={() => onConfirm(mode, encrypted ? passphrase : undefined)}
          >
            読み込む
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function BackupPanel() {
  const status = useBackupStatus();
  const {
    busy,
    error,
    message,
    fileRef,
    exportBackup,
    importBackup,
    readTextFile,
  } = useBackup();
  const [pending, setPending] = useState<{
    fileName: string;
    raw: string;
    encrypted: boolean;
  } | null>(null);
  const [protect, setProtect] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);

  if (status.isLoading) return <Spinner />;

  const lastExportedAt = status.data?.lastExportedAt ?? null;

  return (
    <section className="backup-panel">
      <div ref={liveRef} aria-live="polite" className="visually-hidden">
        {message || error}
      </div>

      <Notice tone="info">
        相関図はこの端末のブラウザ内にのみ保存されています。ブラウザの「Cookieとサイトデータを削除」や端末の故障で失われるため、定期的な書き出しをおすすめします。
      </Notice>

      <dl className="backup-status">
        <div>
          <dt>保存されている相関図</dt>
          <dd>{status.data?.chartCount ?? 0} 件</dd>
        </div>
        <div>
          <dt>最後に書き出した日時</dt>
          <dd>{lastExportedAt ? formatDate(lastExportedAt) : "未実施"}</dd>
        </div>
      </dl>

      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      <div className="backup-protect">
        <label className="check">
          <input
            type="checkbox"
            checked={protect}
            onChange={(event) => {
              setProtect(event.target.checked);
              setPassphrase("");
              setAcknowledged(false);
            }}
          />
          パスフレーズで保護して書き出す
        </label>
        {protect && (
          <>
            <label>
              パスフレーズ
              <input
                type="password"
                autoComplete="new-password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              パスフレーズを忘れると復元できないことを理解しました
            </label>
          </>
        )}
      </div>

      <div className="backup-actions">
        <button
          type="button"
          className="button primary"
          onClick={() => void exportBackup(protect ? passphrase : undefined)}
          disabled={
            busy !== null || (protect && (!passphrase || !acknowledged))
          }
        >
          <Download size={17} aria-hidden="true" />
          {busy === "export" ? "書き出しています…" : "JSONファイルに書き出す"}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
        >
          <Upload size={17} aria-hidden="true" />
          {busy === "import" ? "読み込んでいます…" : "ファイルから読み込む"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            // ここで一度だけ読み、暗号化の有無で入力欄を出し分ける
            const raw = await readTextFile(file);
            const encrypted = await api.isEncryptedFile(raw).catch(() => false);
            setPending({ fileName: file.name, raw, encrypted });
          }}
        />
      </div>

      <div className="backup-guidance">
        <h3>保管のしかた</h3>
        <ul>
          <li>
            書き出したファイルには、入力した氏名やメモがそのまま含まれます。保存先と共有範囲にご注意ください。
          </li>
          <li>
            別の端末で使う場合は、ファイルを移してから「ファイルから読み込む」を選びます。
          </li>
          <li>
            支援対象者など第三者の情報を含む場合、個人のクラウドストレージへの保存は避け、所属機関の定めに従って保管してください。
          </li>
        </ul>
      </div>

      <StorageModeSection />
      <DangerZone />

      {pending && (
        <ImportConfirm
          fileName={pending.fileName}
          encrypted={pending.encrypted}
          onCancel={() => {
            setPending(null);
            if (fileRef.current) fileRef.current.value = "";
          }}
          onConfirm={(mode, entered) => {
            const { raw } = pending;
            setPending(null);
            void importBackup(raw, mode, entered);
          }}
        />
      )}
    </section>
  );
}
