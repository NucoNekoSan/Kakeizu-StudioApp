import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { Notice, Spinner } from "../../components/ui";
import { formatDate } from "../../domain";
import DangerZone from "../storage/DangerZone";
import StorageModeSection from "../storage/StorageModeSection";
import { useBackup, useBackupStatus } from "./useBackup";

export default function BackupPanel() {
  const status = useBackupStatus();
  const { busy, error, message, exportBackup } = useBackup();
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
      </div>

      <div className="backup-guidance">
        <h3>保管のしかた</h3>
        <ul>
          <li>
            書き出したファイルには、入力した氏名やメモがそのまま含まれます。保存先と共有範囲にご注意ください。
          </li>
          <li>
            別の端末で使う場合は、ファイルを移してから画面上部の「ファイル読み込み」を選びます。
          </li>
          <li>
            支援対象者など第三者の情報を含む場合、個人のクラウドストレージへの保存は避け、所属機関の定めに従って保管してください。
          </li>
        </ul>
      </div>

      <StorageModeSection />
      <DangerZone />
    </section>
  );
}
