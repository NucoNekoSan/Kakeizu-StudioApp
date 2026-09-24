import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  GenderDefinition,
  LineStyle,
  RelationKind,
  RelationshipDefinition,
  Shape,
} from "../../types";
import { Modal, Notice, ShapeMark, Shell, Spinner } from "../../components/ui";
import { getErrorMessage, kindLabels, lineLabels } from "../../domain";
import { useSettingsDefinitions } from "./useSettingsDefinitions";
import {
  useGenderMutations,
  useRelationshipMutations,
} from "./useDefinitionMutations";

function SettingsPage() {
  const [tab, setTab] = useState<"relationships" | "genders">("relationships"),
    { relationships, genders } = useSettingsDefinitions();
  return (
    <Shell>
      <main className="page settings-page">
        <div className="page-head">
          <div>
            <span className="eyebrow">CUSTOM DEFINITIONS</span>
            <h1>表示設定</h1>
            <p>相関図で使用する続柄と性別の見た目を管理します。</p>
          </div>
        </div>
        <div className="tabs" role="tablist">
          <button
            id="relationships-tab"
            role="tab"
            aria-selected={tab === "relationships"}
            aria-controls="settings-panel"
            className={tab === "relationships" ? "active" : ""}
            onClick={() => setTab("relationships")}
          >
            続柄 <span>{relationships.data?.length || 0}</span>
          </button>
          <button
            id="genders-tab"
            role="tab"
            aria-selected={tab === "genders"}
            aria-controls="settings-panel"
            className={tab === "genders" ? "active" : ""}
            onClick={() => setTab("genders")}
          >
            性別 <span>{genders.data?.length || 0}</span>
          </button>
        </div>
        <div id="settings-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
          {tab === "relationships" && (
            <RelationshipSettings
              data={relationships.data || []}
              loading={relationships.isLoading}
            />
          )}
          {tab === "genders" && (
            <GenderSettings
              data={genders.data || []}
              loading={genders.isLoading}
            />
          )}
        </div>
      </main>
    </Shell>
  );
}

function RelationshipSettings({
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
function RelationshipModal({
  value,
  onClose,
  onSave,
  error,
}: {
  value: Partial<RelationshipDefinition>;
  onClose(): void;
  onSave(v: Partial<RelationshipDefinition>): void;
  error: string;
}) {
  const [v, setV] = useState(value);
  return (
    <Modal title={value.id ? "続柄を編集" : "続柄を追加"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(v);
        }}
      >
        {error && <Notice tone="error">{error}</Notice>}
        <label>
          表示名
          <input
            required
            maxLength={40}
            value={v.name || ""}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </label>
        <label>
          関係種別
          <select
            value={v.kind}
            onChange={(e) =>
              setV({ ...v, kind: e.target.value as RelationKind })
            }
          >
            {Object.entries(kindLabels).map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            線種
            <select
              value={v.lineStyle}
              onChange={(e) =>
                setV({ ...v, lineStyle: e.target.value as LineStyle })
              }
            >
              {Object.entries(lineLabels).map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            線色
            <input
              type="color"
              value={v.lineColor}
              onChange={(e) => setV({ ...v, lineColor: e.target.value })}
            />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={v.active}
            onChange={(e) => setV({ ...v, active: e.target.checked })}
          />
          選択肢に表示する
        </label>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            キャンセル
          </button>
          <button className="button primary">保存</button>
        </div>
      </form>
    </Modal>
  );
}

function GenderSettings({
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
function GenderModal({
  value,
  onClose,
  onSave,
  error,
}: {
  value: Partial<GenderDefinition>;
  onClose(): void;
  onSave(v: Partial<GenderDefinition>): void;
  error: string;
}) {
  const [v, setV] = useState(value);
  return (
    <Modal title={value.id ? "性別を編集" : "性別を追加"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(v);
        }}
      >
        {error && <Notice tone="error">{error}</Notice>}
        <label>
          表示名
          <input
            required
            maxLength={40}
            value={v.name || ""}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </label>
        <label>
          形状
          <select
            value={v.shape}
            onChange={(e) => setV({ ...v, shape: e.target.value as Shape })}
          >
            <option value="circle">円</option>
            <option value="square">四角</option>
            <option value="diamond">ひし形</option>
          </select>
        </label>
        <div className="form-row">
          <label>
            塗り色
            <input
              type="color"
              value={v.fillColor}
              onChange={(e) => setV({ ...v, fillColor: e.target.value })}
            />
          </label>
          <label>
            文字色
            <input
              type="color"
              value={v.textColor}
              onChange={(e) => setV({ ...v, textColor: e.target.value })}
            />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={v.active}
            onChange={(e) => setV({ ...v, active: e.target.checked })}
          />
          選択肢に表示する
        </label>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            キャンセル
          </button>
          <button className="button primary">保存</button>
        </div>
      </form>
    </Modal>
  );
}

export default SettingsPage;
