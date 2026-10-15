import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { GenderDefinition } from "../../types";
import { ShapeMark, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../domain";
import { useGenderMutations } from "./useDefinitionMutations";
import { GenderModal } from "./GenderModal";

export function GenderSettings({
  data,
  loading,
}: {
  data: GenderDefinition[];
  loading: boolean;
}) {
  const [editing, setEditing] = useState<Partial<GenderDefinition> | null>(
    null,
  );
  const { save, remove } = useGenderMutations(() => setEditing(null));
  if (loading) return <Spinner />;
  return (
    <section className="settings-section">
      <div className="section-toolbar">
        <div>
          <h2>性別</h2>
          <p>ノードの形と色を設定します。</p>
        </div>
        <button
          className="button primary"
          onClick={() =>
            setEditing({
              name: "",
              shape: "circle",
              fillColor: "#315d4b",
              textColor: "#ffffff",
              sortOrder: data.length,
              active: true,
            })
          }
        >
          <Plus size={17} />
          性別を追加
        </button>
      </div>
      <div className="definition-list">
        {data.map((g) => (
          <article className={!g.active ? "inactive" : ""} key={g.id}>
            <ShapeMark
              shape={g.shape}
              color={g.fillColor}
              textColor={g.textColor}
              label={g.name}
            />
            <div className="definition-main">
              <h3>
                {g.name}
                {!g.active && <span className="badge">無効</span>}
              </h3>
              <p>
                {g.shape === "circle"
                  ? "円"
                  : g.shape === "square"
                    ? "四角"
                    : "ひし形"}{" "}
                · {g.fillColor.toUpperCase()}
              </p>
            </div>
            <span className="usage">{g.usageCount || 0}件で使用</span>
            <button className="button compact" onClick={() => setEditing(g)}>
              編集
            </button>
            <button
              className="icon danger"
              aria-label={`${g.name}を削除`}
              disabled={!!g.usageCount}
              title={g.usageCount ? "使用中の性別は削除できません" : ""}
              onClick={() =>
                confirm("この性別を削除しますか？") && remove.mutate(g.id)
              }
            >
              <Trash2 size={17} />
            </button>
          </article>
        ))}
      </div>
      {editing && (
        <GenderModal
          value={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => save.mutate(v)}
          error={save.error ? getErrorMessage(save.error) : ""}
        />
      )}
    </section>
  );
}
