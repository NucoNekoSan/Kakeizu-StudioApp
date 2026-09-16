import { useState } from "react";
import { Notice } from "../../components/ui";
import { resetStoreCache } from "../../storage/localApi";
import {
  readStorageMode,
  writeStorageMode,
  type StorageMode,
} from "../../storage/storageMode";

const LABELS: Record<StorageMode, string> = {
  persistent: "この端末に保存する",
  session: "今回だけ使う（端末に残さない）",
};

/**
 * 保存モードの確認と切り替え。
 *
 * 「今回だけ」へ切り替えると以降の書き込みは端末に残らないが、
 * それまでに保存済みのデータは残る。消すには全データ削除が要る。
 */
export default function StorageModeSection() {
  const [mode, setMode] = useState<StorageMode>(
    () => readStorageMode() ?? "persistent",
  );
  const [switched, setSwitched] = useState(false);

  const change = (next: StorageMode) => {
    if (next === mode) return;
    writeStorageMode(next);
    resetStoreCache();
    setMode(next);
    setSwitched(true);
  };

  return (
    <section className="storage-mode">
      <h3>保存方法</h3>
      <p className="muted">現在の設定: {LABELS[mode]}</p>
      <div className="backup-actions">
        {(Object.keys(LABELS) as StorageMode[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`button${option === mode ? " primary" : ""}`}
            onClick={() => change(option)}
          >
            {LABELS[option]}
          </button>
        ))}
      </div>
      {switched && mode === "session" && (
        <Notice tone="info">
          以降の変更はこの端末に残りません。再読み込みすると作業中の内容も消えます。すでに保存されているデータを消すには、下の「この端末のデータをすべて削除」をお使いください。
        </Notice>
      )}
      {switched && mode === "persistent" && (
        <Notice tone="info">
          以降の変更はこの端末に保存されます。画面を再読み込みすると切り替わります。
        </Notice>
      )}
    </section>
  );
}
