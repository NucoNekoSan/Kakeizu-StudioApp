import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, GitBranch, Plus, Trash2 } from "lucide-react";
import { api } from "../../api";
import { Modal, Notice, Shell, Spinner } from "../../components/ui";
import { formatDate, getErrorMessage } from "../../domain";
import { saveJsonFile } from "../../storage/fileIo";
import type { ChartSummary } from "../../types";
import BackupReminder from "../backup/BackupReminder";
import { useTutorial } from "../tutorial/tutorialContext";

function ChartPreview() {
  return (
    <span className="chart-preview" aria-hidden="true">
      <span className="preview-node one" />
      <span className="preview-node two" />
      <span className="preview-node three" />
      <span className="preview-line a" />
      <span className="preview-line b" />
    </span>
  );
}

function ChartCardCopy({ chart }: { readonly chart: ChartSummary }) {
  return (
    <span className="chart-card-copy">
      <h2>{chart.title}</h2>
      <p>
        {chart.nodeCount} ノード · {formatDate(chart.updatedAt)}
      </p>
    </span>
  );
}

function ChartsPage() {
  const nav = useNavigate();
  const tutorial = useTutorial();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [show, setShow] = useState(false);
  const [isSelectingBackup, setIsSelectingBackup] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState("");
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const charts = useQuery({ queryKey: ["charts"], queryFn: api.charts });
  const create = useMutation({
    mutationFn: api.createChart,
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["charts"] });
      tutorial.reportAction("chart-created", c.id);
      nav(`/charts/${c.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: api.deleteChart,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["charts"] }),
  });

  const cancelBackupSelection = useCallback(() => {
    if (isExportingBackup) return;
    setIsSelectingBackup(false);
    setSelectedBackupId("");
    setBackupError("");
  }, [isExportingBackup]);

  const toggleBackupSelection = () => {
    if (isSelectingBackup) {
      cancelBackupSelection();
      return;
    }
    setBackupMessage("");
    setBackupError("");
    setSelectedBackupId("");
    setIsSelectingBackup(true);
  };

  const exportSelectedChart = async () => {
    if (!selectedBackupId) return;
    setIsExportingBackup(true);
    setBackupError("");
    try {
      const { fileName, json } = await api.createChartBackup(selectedBackupId);
      const saved = await saveJsonFile(fileName, json);
      if (!saved) return;
      setBackupMessage(`${fileName} を書き出しました。`);
      tutorial.reportAction("backup-exported", selectedBackupId);
      setIsSelectingBackup(false);
      setSelectedBackupId("");
    } catch (caught) {
      setBackupError(getErrorMessage(caught));
    } finally {
      setIsExportingBackup(false);
    }
  };

  useEffect(() => {
    if (!isSelectingBackup) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isExportingBackup) return;
      event.preventDefault();
      cancelBackupSelection();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cancelBackupSelection, isExportingBackup, isSelectingBackup]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: "create_family_chart",
          title: "相関図を作成",
          description: "タイトルを指定して新しい空の家族相関図を作成します。",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", minLength: 1, maxLength: 80 },
            },
            required: ["title"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async (input) => {
            const value = input as { title?: unknown };
            if (typeof value.title !== "string" || !value.title.trim())
              throw new Error("title is required");
            const result = await api.createChart(value.title.trim());
            await qc.invalidateQueries({ queryKey: ["charts"] });
            return { id: result.id, title: result.title };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [qc]);
  const selectedChart = charts.data?.find(
    (chart) => chart.id === selectedBackupId,
  );
  const isBackupActionDisabled =
    isExportingBackup ||
    (!isSelectingBackup &&
      (charts.isLoading || charts.isError || !charts.data?.length));

  return (
    <Shell
      backupMode="chart"
      chartBackupAction={{
        isActive: isSelectingBackup,
        isDisabled: isBackupActionDisabled,
        message: backupMessage,
        onToggle: toggleBackupSelection,
      }}
    >
      <main className="page">
        <div className="page-head" data-tutorial-target="charts-heading">
          <div>
            <span className="eyebrow">MY FAMILY MAPS</span>
            <h1>相関図</h1>
            <p>続柄とメモから、家族のつながりを整理します。</p>
          </div>
          <button
            className="button primary"
            data-tutorial-target="create-chart"
            onClick={() => setShow(true)}
          >
            <Plus size={18} />
            新しい相関図
          </button>
        </div>
        {isSelectingBackup ? (
          <section
            className="backup-selection-bar"
            aria-labelledby="backup-selection-title"
          >
            <div className="backup-selection-copy">
              <strong id="backup-selection-title">
                バックアップする相関図を選択してください
              </strong>
              <p aria-live="polite">
                {selectedChart
                  ? `「${selectedChart.title}」を選択中です。`
                  : "相関図は1件だけ選択できます。"}
              </p>
            </div>
            <div className="backup-selection-actions">
              <button
                type="button"
                className="button"
                onClick={cancelBackupSelection}
                disabled={isExportingBackup}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => void exportSelectedChart()}
                disabled={!selectedBackupId || isExportingBackup}
              >
                {isExportingBackup
                  ? "書き出しています…"
                  : "JSONファイルに書き出す"}
              </button>
            </div>
            {backupError && <Notice tone="error">{backupError}</Notice>}
          </section>
        ) : (
          <BackupReminder onExport={toggleBackupSelection} />
        )}
        {charts.isLoading ? (
          <Spinner />
        ) : charts.isError ? (
          <Notice tone="error">{getErrorMessage(charts.error)}</Notice>
        ) : charts.data?.length ? (
          isSelectingBackup ? (
            <fieldset className="chart-grid chart-selection-grid">
              <legend className="visually-hidden">
                バックアップする相関図
              </legend>
              {charts.data.map((chart) => {
                const inputId = `backup-chart-${chart.id}`;
                return (
                  <label
                    className="chart-card chart-card-selectable"
                    htmlFor={inputId}
                    key={chart.id}
                  >
                    <input
                      className="visually-hidden"
                      id={inputId}
                      type="radio"
                      name="backup-chart"
                      value={chart.id}
                      checked={selectedBackupId === chart.id}
                      onChange={() => {
                        setSelectedBackupId(chart.id);
                        setBackupError("");
                      }}
                    />
                    <ChartPreview />
                    <ChartCardCopy chart={chart} />
                    <span className="chart-selection-mark" aria-hidden="true">
                      <Check size={18} />
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <div className="chart-grid">
              {charts.data.map((chart) => (
                <article className="chart-card" key={chart.id}>
                  <button
                    className="chart-preview"
                    onClick={() => nav(`/charts/${chart.id}`)}
                    aria-label={`${chart.title}を開く`}
                  >
                    <span className="preview-node one" />
                    <span className="preview-node two" />
                    <span className="preview-node three" />
                    <span className="preview-line a" />
                    <span className="preview-line b" />
                  </button>
                  <ChartCardCopy chart={chart} />
                  <div className="chart-card-actions">
                    <button
                      className="icon danger"
                      aria-label={`${chart.title}を削除`}
                      data-tooltip="削除"
                      onClick={() =>
                        confirm(`「${chart.title}」を削除しますか？`) &&
                        remove.mutate(chart.id)
                      }
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : (
          <div className="empty">
            <div className="empty-icon">
              <GitBranch />
            </div>
            <h2>最初の相関図を作成</h2>
            <p>続柄と性別を選ぶだけで、ノードと関係線を自動で配置します。</p>
            <button className="button primary" onClick={() => setShow(true)}>
              <Plus size={18} />
              相関図を作る
            </button>
          </div>
        )}
        {show && (
          <Modal title="新しい相関図" onClose={() => setShow(false)}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (title.trim()) create.mutate(title.trim());
              }}
            >
              <label>
                タイトル
                <input
                  autoFocus
                  maxLength={80}
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：母方の家族"
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => setShow(false)}
                >
                  キャンセル
                </button>
                <button className="button primary">作成する</button>
              </div>
            </form>
          </Modal>
        )}
      </main>
    </Shell>
  );
}

export default ChartsPage;
