import type { Node } from "@xyflow/react";
import { Baby, Plus, Trash2, UserRoundPlus, Users } from "lucide-react";
import type { Direction } from "../../types";
import type { FamilyNodeData } from "../../familyGraph";
import { directionLabels } from "../../domain";
import { quickRelationLabels, type QuickRelation } from "./editorPresets";
import { useNodeForm, type NodeFormProps } from "./useNodeForm";
import { NodeTextFields } from "./NodeTextFields";

export function QuickAddActions({
  node,
  onSelect,
}: {
  node: Node<FamilyNodeData>;
  onSelect(kind: QuickRelation): void;
}) {
  return (
    <section
      className="quick-add"
      aria-labelledby="quick-add-title"
      data-tutorial-target="quick-add"
    >
      <h2 id="quick-add-title">この人物の家族を追加</h2>
      <p>{node.data.relationshipName}との関係を選ぶと接続を自動設定します。</p>
      <div className="quick-add-grid">
        <button type="button" onClick={() => onSelect("partner")}>
          <UserRoundPlus aria-hidden="true" /> 配偶者
        </button>
        <button type="button" onClick={() => onSelect("child")}>
          <Baby aria-hidden="true" /> 子
        </button>
        <button type="button" onClick={() => onSelect("parent")}>
          <UserRoundPlus aria-hidden="true" /> 親
        </button>
        <button type="button" onClick={() => onSelect("sibling")}>
          <Users aria-hidden="true" /> 兄弟姉妹
        </button>
      </div>
    </section>
  );
}

export function NodeForm(props: NodeFormProps) {
  const { mode, nodes, preset, onDelete } = props;
  const {
    relationshipId,
    genderId,
    anchorNodeId,
    parentNodeId1,
    parentNodeId2,
    placementDirection,
    connectionDirection,
    divorced,
    memo,
    fontSize,
    relationshipFontSize,
    activeR,
    activeG,
    presetAnchor,
    partnerIds,
    options,
    pairValid,
    hasParentPair,
    selectedRelation,
    suggestedParent2,
    submit,
    changePlacementDirection,
    changeAnchor,
    changeRelationship,
    changeGender,
    changeConnectionDirection,
    changeParent2,
    changeParent1,
    applySuggestedParent,
    toggleDivorced,
    changeMemo,
    changeFontSize,
    changeRelationshipFontSize,
  } = useNodeForm(props);
  return (
    <form className="node-form" onSubmit={submit}>
      <div className="panel-title">
        <span className="eyebrow">
          {mode === "add" ? "NEW NODE" : "SELECTED NODE"}
        </span>
        <h2>
          {mode === "add" && preset
            ? quickRelationLabels[preset.kind]
            : mode === "add"
              ? "ノードを追加"
              : "ノードを編集"}
        </h2>
      </div>
      {preset && presetAnchor && (
        <p className="family-context">
          基準人物：<strong>{presetAnchor.data.relationshipName}</strong>
          {presetAnchor.data.memo
            ? ` — ${presetAnchor.data.memo.slice(0, 20)}`
            : ""}
        </p>
      )}
      {nodes.length > 0 && !preset && (
        <label>
          基準ノード
          <select
            value={anchorNodeId || ""}
            onChange={(e) => changeAnchor(e.target.value)}
            required
          >
            <option value="" disabled>
              選択してください
            </option>
            {options.map((n) => (
              <option value={n.id} key={n.id}>
                {n.data.relationshipName}
                {n.data.memo ? ` — ${n.data.memo.slice(0, 14)}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        続柄
        <select
          value={relationshipId}
          onChange={(e) => changeRelationship(e.target.value)}
          required
        >
          {activeR.map((r) => (
            <option value={r.id} key={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {preset && !activeR.length && (
          <small className="field-error">
            この関係種別の続柄がありません。表示設定で追加してください。
          </small>
        )}
      </label>
      <label>
        性別
        <select
          value={genderId}
          onChange={(e) => changeGender(e.target.value)}
          required
        >
          {activeG.map((g) => (
            <option value={g.id} key={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      {mode === "add" && !preset && (
        <label>
          配置方向
          <select
            value={placementDirection}
            onChange={(e) =>
              changePlacementDirection(e.target.value as Direction)
            }
          >
            {Object.entries(directionLabels).map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {mode === "edit" && (
        <label>
          線の接続方向
          <select
            value={connectionDirection || ""}
            disabled={!anchorNodeId || hasParentPair}
            onChange={(e) => changeConnectionDirection(e.target.value)}
          >
            <option value="">自動（現在位置から判定）</option>
            {Object.entries(directionLabels).map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
          {hasParentPair && (
            <small className="field-hint">兄弟線は自動配置されます。</small>
          )}
        </label>
      )}
      {preset?.kind === "child" && (
        <fieldset className="parent-pair">
          <legend>もう一方の親</legend>
          <p>配偶者を選ぶと、その二人の子として家族線を作ります。</p>
          <label>
            配偶者
            <select
              value={parentNodeId2 || ""}
              onChange={(e) => changeParent2(e.target.value)}
            >
              <option value="">指定しない（片親）</option>
              {options
                .filter((node) => partnerIds.includes(node.id))
                .map((node) => (
                  <option value={node.id} key={node.id}>
                    {node.data.relationshipName}
                    {node.data.memo ? ` — ${node.data.memo.slice(0, 14)}` : ""}
                  </option>
                ))}
            </select>
          </label>
          {!partnerIds.length && (
            <small className="field-hint">
              配偶者が未登録のため、片親の子として追加します。
            </small>
          )}
          {partnerIds.length === 1 && (
            <small className="field-hint">
              配偶者をもう一方の親として自動選択しました。
            </small>
          )}
          {partnerIds.length > 1 && (
            <small className="field-hint">
              配偶者が複数います。どの配偶者との子か選択してください。
            </small>
          )}
        </fieldset>
      )}
      {(mode === "edit" || !preset || preset.kind === "sibling") && (
        <fieldset className="parent-pair">
          <legend>兄弟姉妹追加時に</legend>
          <p>
            兄弟姉妹を追加する場合は、同じ父母を指定すると共通の兄弟線でまとめられます。
          </p>
          <label>
            父
            <select
              value={parentNodeId1 || ""}
              onChange={(e) => changeParent1(e.target.value)}
            >
              <option value="">指定なし</option>
              {options
                .filter((n) => n.id !== parentNodeId2)
                .map((n) => (
                  <option value={n.id} key={n.id}>
                    {n.data.relationshipName}
                    {n.data.memo ? ` — ${n.data.memo.slice(0, 14)}` : ""}
                  </option>
                ))}
            </select>
          </label>
          <label>
            母
            <select
              value={parentNodeId2 || ""}
              onChange={(e) => changeParent2(e.target.value)}
            >
              <option value="">指定なし</option>
              {options
                .filter((n) => n.id !== parentNodeId1)
                .map((n) => (
                  <option value={n.id} key={n.id}>
                    {n.data.relationshipName}
                    {n.data.memo ? ` — ${n.data.memo.slice(0, 14)}` : ""}
                  </option>
                ))}
            </select>
          </label>
          {suggestedParent2 && (
            <button
              type="button"
              className="button compact"
              onClick={applySuggestedParent}
            >
              配偶者「{suggestedParent2.data.relationshipName}」を母に設定
            </button>
          )}
          {!pairValid && (
            <small className="field-error">
              父と母は異なる2名を選択してください。
            </small>
          )}
        </fieldset>
      )}
      {mode === "edit" &&
        (selectedRelation?.kind === "partner" ||
          selectedRelation?.kind === "divorce") && (
          <button
            type="button"
            className={`button wide divorce-toggle ${divorced ? "danger" : ""}`}
            aria-pressed={divorced}
            onClick={toggleDivorced}
          >
            {divorced ? "離婚を解除" : "離婚に設定（二重斜線）"}
          </button>
        )}
      <NodeTextFields
        memo={memo}
        fontSize={fontSize}
        relationshipFontSize={relationshipFontSize}
        onMemoChange={changeMemo}
        onFontSizeChange={changeFontSize}
        onRelationshipFontSizeChange={changeRelationshipFontSize}
      />
      {mode === "add" && (
        <button
          type="submit"
          className="button primary wide"
          disabled={!relationshipId || !genderId || !pairValid}
        >
          <Plus size={17} />
          自動配置して追加
        </button>
      )}
      {mode === "edit" && (
        <button type="button" className="button danger wide" onClick={onDelete}>
          <Trash2 size={17} />
          ノードを削除
        </button>
      )}
    </form>
  );
}
