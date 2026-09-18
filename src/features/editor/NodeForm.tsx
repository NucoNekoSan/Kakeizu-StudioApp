import { type FormEvent, useEffect, useRef, useState } from "react";
import type { Node } from "@xyflow/react";
import { Baby, Plus, Trash2, UserRoundPlus, Users } from "lucide-react";
import type { ChartDetail, ChartNodeRecord, Direction } from "../../types";
import { findFreePosition } from "../../placement";
import type { FamilyNodeData } from "../../familyGraph";
import { directionLabels } from "../../domain";
import {
  findPartnerIds,
  quickDirection,
  quickRelationLabels,
  type AddPreset,
  type NodeDraft,
  type QuickRelation,
} from "./editorPresets";
import { NodeTextFields } from "./NodeTextFields";

export function QuickAddActions({
  node,
  onSelect,
}: {
  node: Node<FamilyNodeData>;
  onSelect(kind: QuickRelation): void;
}) {
  return (
    <section className="quick-add" aria-labelledby="quick-add-title">
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

export function NodeForm({
  mode,
  detail,
  nodes,
  value,
  preset,
  onSubmit,
  onDelete,
  onConnectionPreview,
  onDraftChange,
  onChange,
}: {
  mode: "add" | "edit";
  detail: ChartDetail;
  nodes: Node<FamilyNodeData>[];
  value?: Node<FamilyNodeData> | null;
  preset?: AddPreset | null;
  onSubmit(v: Omit<ChartNodeRecord, "id">): void;
  onDelete?(): void;
  onConnectionPreview?(direction: Direction | null): void;
  onDraftChange?(draft: NodeDraft | null): void;
  onChange?(input: Partial<Omit<ChartNodeRecord, "id">>): void;
}) {
  const presetKinds =
      preset?.kind === "partner"
        ? ["partner", "divorce"]
        : preset
          ? [preset.kind]
          : null,
    activeR = detail.relationships.filter(
      (v) =>
        (v.active || v.id === value?.data.relationshipId) &&
        (!presetKinds || presetKinds.includes(v.kind)),
    ),
    activeG = detail.genders.filter(
      (v) => v.active || v.id === value?.data.genderId,
    ),
    presetAnchor = nodes.find((node) => node.id === preset?.anchorId),
    partnerIds = findPartnerIds(preset?.anchorId, nodes),
    record = value ? detail.nodes.find((n) => n.id === value.id) : undefined,
    [relationshipId, setRelationship] = useState(
      value?.data.relationshipId || activeR[0]?.id || "",
    ),
    [genderId, setGender] = useState(
      value?.data.genderId || activeG[0]?.id || "",
    ),
    [anchorNodeId, setAnchor] = useState<string | null>(
      record?.anchorNodeId || preset?.anchorId || nodes[0]?.id || null,
    ),
    [parentNodeId1, setParent1] = useState<string | null>(
      record?.parentNodeId1 ||
        (preset?.kind === "child" ? preset.anchorId : null) ||
        (preset?.kind === "sibling"
          ? nodes.find((node) => node.id === preset.anchorId)?.data
              .parentNodeId1 || null
          : null),
    ),
    [parentNodeId2, setParent2] = useState<string | null>(
      record?.parentNodeId2 ||
        (preset?.kind === "child" && partnerIds.length === 1
          ? partnerIds[0]
          : preset?.kind === "sibling"
            ? nodes.find((node) => node.id === preset.anchorId)?.data
                .parentNodeId2 || null
            : null),
    ),
    [placementDirection, setDirection] = useState<Direction>(
      record?.placementDirection || quickDirection(preset, nodes),
    ),
    [connectionDirection, setConnectionDirection] = useState<Direction | null>(
      record?.connectionDirection || null,
    ),
    [divorced, setDivorced] = useState(record?.divorced || false),
    [memo, setMemo] = useState(value?.data.memo || ""),
    [fontSize, setFontSize] = useState(value?.data.fontSize || 16),
    [relationshipFontSize, setRelationshipFontSize] = useState(
      value?.data.relationshipFontSize || 17,
    );
  const hydrated = useRef(false);
  const hydratedNodeId = useRef<string | null>(null);
  useEffect(() => {
    if (!value) {
      hydratedNodeId.current = null;
      return;
    }
    if (hydratedNodeId.current === value.id) return;
    hydratedNodeId.current = value.id;
    hydrated.current = false;
    const r = detail.nodes.find((n) => n.id === value.id);
    setRelationship(value.data.relationshipId);
    setGender(value.data.genderId);
    setMemo(value.data.memo);
    setFontSize(value.data.fontSize);
    setRelationshipFontSize(value.data.relationshipFontSize);
    setAnchor(r?.anchorNodeId || null);
    setParent1(r?.parentNodeId1 || null);
    setParent2(r?.parentNodeId2 || null);
    setDirection(r?.placementDirection || "right");
    setConnectionDirection(r?.connectionDirection || null);
    setDivorced(r?.divorced || false);
  }, [value, detail.nodes]);
  useEffect(() => {
    if (mode !== "edit" || !value?.id || !onChange) return;
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    onChange({ fontSize, relationshipFontSize });
  }, [mode, value?.id, onChange, fontSize, relationshipFontSize]);
  const draftNodeId = value?.id;
  useEffect(
    () => () => {
      if (mode === "edit" && draftNodeId) onDraftChange?.(null);
    },
    [draftNodeId, mode, onDraftChange],
  );
  const options = nodes.filter((n) => n.id !== value?.id),
    pairValid = !parentNodeId2 || parentNodeId1 !== parentNodeId2,
    hasParentPair = !!(parentNodeId1 && parentNodeId2),
    selectedRelation = detail.relationships.find(
      (r) => r.id === relationshipId,
    ),
    parentPartnerIds = findPartnerIds(parentNodeId1, nodes),
    suggestedParent2 =
      mode === "edit" &&
      selectedRelation?.kind === "child" &&
      parentNodeId1 &&
      !parentNodeId2 &&
      parentPartnerIds.length === 1
        ? nodes.find((node) => node.id === parentPartnerIds[0])
        : undefined,
    submit = (e: FormEvent) => {
      e.preventDefault();
      const anchor = nodes.find((n) => n.id === anchorNodeId),
        base = anchor?.position || value?.position || { x: 240, y: 180 },
        placed =
          mode === "add"
            ? selectedRelation?.kind === "self"
              ? { x: 0, y: 0 }
              : findFreePosition(
                  base,
                  placementDirection,
                  nodes
                    .filter((n) => n.id !== value?.id)
                    .map((n) => n.position),
                )
            : value?.position || base;
      onSubmit({
        relationshipId,
        genderId,
        anchorNodeId: nodes.length ? anchorNodeId : null,
        parentNodeId1,
        parentNodeId2,
        placementDirection,
        connectionDirection,
        divorced,
        memo: memo.slice(0, 2000),
        fontSize,
        relationshipFontSize,
        scale: value?.data.scale || 1,
        x: placed.x,
        y: placed.y,
      });
    };
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
            onChange={(e) => {
              const next = e.target.value;
              setAnchor(next);
              if (mode === "edit") onChange?.({ anchorNodeId: next });
            }}
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
          onChange={(e) => {
            const next = e.target.value;
            setRelationship(next);
            if (mode === "edit") onChange?.({ relationshipId: next });
          }}
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
          onChange={(e) => {
            const next = e.target.value;
            setGender(next);
            if (mode === "edit") onChange?.({ genderId: next });
          }}
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
            onChange={(e) => setDirection(e.target.value as Direction)}
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
            onChange={(e) => {
              const direction = (e.target.value || null) as Direction | null;
              setConnectionDirection(direction);
              onConnectionPreview?.(direction);
              if (mode === "edit")
                onChange?.({ connectionDirection: direction });
            }}
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
              onChange={(e) => {
                const next = e.target.value || null;
                setParent2(next);
                if (mode === "edit") onChange?.({ parentNodeId2: next });
              }}
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
              onChange={(e) => {
                const next = e.target.value || null;
                setParent1(next);
                if (mode === "edit") onChange?.({ parentNodeId1: next });
              }}
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
              onChange={(e) => {
                const next = e.target.value || null;
                setParent2(next);
                if (mode === "edit") onChange?.({ parentNodeId2: next });
              }}
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
              onClick={() => {
                setParent2(suggestedParent2.id);
                if (mode === "edit")
                  onChange?.({
                    parentNodeId1,
                    parentNodeId2: suggestedParent2.id,
                  });
              }}
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
            onClick={() => {
              const next = !divorced;
              setDivorced(next);
              if (mode === "edit") onChange?.({ divorced: next });
            }}
          >
            {divorced ? "離婚を解除" : "離婚に設定（二重斜線）"}
          </button>
        )}
      <NodeTextFields
        memo={memo}
        fontSize={fontSize}
        relationshipFontSize={relationshipFontSize}
        onMemoChange={(nextMemo) => {
          setMemo(nextMemo);
          if (mode === "edit" && draftNodeId) {
            onDraftChange?.({
              nodeId: draftNodeId,
              memo: nextMemo,
              fontSize,
              relationshipFontSize,
            });
            onChange?.({ memo: nextMemo.slice(0, 2000) });
          }
        }}
        onFontSizeChange={(nextFontSize) => {
          setFontSize(nextFontSize);
          if (mode === "edit" && draftNodeId)
            onDraftChange?.({
              nodeId: draftNodeId,
              memo,
              fontSize: nextFontSize,
              relationshipFontSize,
            });
        }}
        onRelationshipFontSizeChange={(nextRelationshipFontSize) => {
          setRelationshipFontSize(nextRelationshipFontSize);
          if (mode === "edit" && draftNodeId)
            onDraftChange?.({
              nodeId: draftNodeId,
              memo,
              fontSize,
              relationshipFontSize: nextRelationshipFontSize,
            });
        }}
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
