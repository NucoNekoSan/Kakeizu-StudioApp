import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { api } from "../../api";
import { Modal, Notice, Shell, Spinner } from "../../components/ui";
import { formatDate, getErrorMessage } from "../../domain";
import BackupReminder from "../backup/BackupReminder";

function ChartsPage() {
  const nav = useNavigate(),
    qc = useQueryClient(),
    [title, setTitle] = useState(""),
    [show, setShow] = useState(false),
    charts = useQuery({ queryKey: ["charts"], queryFn: api.charts });
  const create = useMutation({
    mutationFn: api.createChart,
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["charts"] });
      nav(`/charts/${c.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: api.deleteChart,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["charts"] }),
  });
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
  return (
    <Shell>
      <main className="page">
        <div className="page-head">
          <div>
            <span className="eyebrow">MY FAMILY MAPS</span>
            <h1>相関図</h1>
            <p>続柄とメモから、家族のつながりを整理します。</p>
          </div>
          <button className="button primary" onClick={() => setShow(true)}>
            <Plus size={18} />
            新しい相関図
          </button>
        </div>
        <BackupReminder />
        {charts.isLoading ? (
          <Spinner />
        ) : charts.isError ? (
          <Notice tone="error">{getErrorMessage(charts.error)}</Notice>
        ) : charts.data?.length ? (
          <div className="chart-grid">
            {charts.data.map((c) => (
              <article className="chart-card" key={c.id}>
                <button
                  className="chart-preview"
                  onClick={() => nav(`/charts/${c.id}`)}
                >
                  <span className="preview-node one" />
                  <span className="preview-node two" />
                  <span className="preview-node three" />
                  <span className="preview-line a" />
                  <span className="preview-line b" />
                </button>
                <div>
                  <h2>{c.title}</h2>
                  <p>
                    {c.nodeCount} ノード · {formatDate(c.updatedAt)}
                  </p>
                </div>
                <button
                  className="icon danger"
                  aria-label={`${c.title}を削除`}
                  onClick={() =>
                    confirm(`「${c.title}」を削除しますか？`) &&
                    remove.mutate(c.id)
                  }
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </div>
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
