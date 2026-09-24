import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DatabaseBackup } from "lucide-react";
import { api } from "../../api";
import { Modal, Notice, Spinner } from "../../components/ui";
import { formatDate, getErrorMessage } from "../../domain";
import { saveJsonFile } from "../../storage/fileIo";

export default function ChartBackupSelectButton() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const charts = useQuery({
    queryKey: ["charts"],
    queryFn: api.charts,
    enabled: open,
  });

  const close = () => {
    if (busy) return;
    setOpen(false);
    setSelectedId("");
    setError("");
  };

  const exportChart = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError("");
    try {
      const { fileName, json } = await api.createChartBackup(selectedId);
      const saved = await saveJsonFile(fileName, json);
      if (!saved) return;
      setMessage(`${fileName} を書き出しました。`);
      setOpen(false);
      setSelectedId("");
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
        onClick={() => {
          setMessage("");
          setOpen(true);
        }}
        aria-label="相関図を選択してバックアップ"
        data-tooltip="バックアップ"
      >
        <DatabaseBackup size={17} aria-hidden="true" />
        <span className="button-label">バックアップ</span>
      </button>
      {message && (
        <div className="header-toast" role="status" aria-live="polite">
          {message}
        </div>
      )}
      {open && (
        <Modal title="相関図をバックアップ" onClose={close}>
          <div className="modal-body">
            <p>JSONファイルに書き出す相関図を1件選択してください。</p>
            {charts.isLoading ? (
              <Spinner label="相関図を読み込んでいます" />
            ) : charts.isError ? (
              <Notice tone="error">{getErrorMessage(charts.error)}</Notice>
            ) : charts.data?.length ? (
              <fieldset className="chart-backup-options">
                <legend className="visually-hidden">相関図を選択</legend>
                {charts.data.map((chart) => (
                  <label key={chart.id}>
                    <input
                      type="radio"
                      name="backup-chart"
                      value={chart.id}
                      checked={selectedId === chart.id}
                      onChange={() => setSelectedId(chart.id)}
                    />
                    <span>
                      <strong>{chart.title}</strong>
                      <small>
                        {chart.nodeCount} ノード · {formatDate(chart.updatedAt)}
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <Notice tone="info">書き出せる相関図がありません。</Notice>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            <div className="modal-actions">
              <button
                type="button"
                className="button"
                onClick={close}
                disabled={busy}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => void exportChart()}
                disabled={!selectedId || busy}
              >
                {busy ? "書き出しています…" : "JSONファイルに書き出す"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
