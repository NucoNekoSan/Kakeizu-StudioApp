import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { RelationshipDefinition } from "../../types";
import { Spinner } from "../../components/ui";
import { getErrorMessage, kindLabels, lineLabels } from "../../domain";
import { useRelationshipMutations } from "./useDefinitionMutations";
import { RelationshipModal } from "./RelationshipModal";

export function RelationshipSettings({
  data,
  loading,
}: {
  data: RelationshipDefinition[];
  loading: boolean;
}) {
  const [editing, setEditing] =
    useState<Partial<RelationshipDefinition> | null>(null);
  const { save, remove } = useRelationshipMutations(() => setEditing(null));
  if (loading) return <Spinner />;
  return (
    <section className="settings-section">
      <div className="section-toolbar">
        <div>
          <h2>続柄</h2>
          <p>続柄の名称と関係線を設定します。</p>
        </div>
        <button
          className="button primary"
          onClick={() =>
            setEditing({
              name: "",
              kind: "other",
              direction: "right",
              lineStyle: "solid",
              lineColor: "#52645e",
              sortOrder: data.length,
              active: true,
            })
          }
        >
          <Plus size={17} />
          続柄を追加
        </button>
      </div>
      <div className="definition-list">
        {data.map((r) => (
          <article className={!r.active ? "inactive" : ""} key={r.id}>
            <div
              className="line-swatch"
              style={{
                borderColor: r.lineColor,
                borderTopStyle:
                  r.lineStyle === "solid"
                    ? "solid"
                    : r.lineStyle === "dashed"
                      ? "dashed"
                      : "dotted",
              }}
            />
            <div className="definition-main">
              <h3>
                {r.name}
                {!r.active && <span className="badge">無効</span>}
              </h3>
              <p>
                {kindLabels[r.kind]} · {lineLabels[r.lineStyle]}
              </p>
            </div>
            <span className="usage">{r.usageCount || 0}件で使用</span>
            <button className="button compact" onClick={() => setEditing(r)}>
              編集
            </button>
            <button
              className="icon danger"
              aria-label={`${r.name}を削除`}
              disabled={!!r.usageCount}
              title={r.usageCount ? "使用中の続柄は削除できません" : ""}
              onClick={() =>
                confirm("この続柄を削除しますか？") && remove.mutate(r.id)
              }
            >
              <Trash2 size={17} />
            </button>
          </article>
        ))}
      </div>
      {editing && (
        <RelationshipModal
          value={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => save.mutate(v)}
          error={save.error ? getErrorMessage(save.error) : ""}
        />
      )}
    </section>
  );
}
