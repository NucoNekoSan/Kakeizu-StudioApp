import { useState, type KeyboardEvent } from "react";
import type { Node } from "@xyflow/react";
import type { FamilyNodeData } from "../../familyGraph";
import type { Cohabitation, CohabitationLabel } from "./cohabitationModel";

interface NumericFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange(value: number): void;
}

function NumericField({ label, value, min, max, onChange }: NumericFieldProps) {
  const clamp = (next: number) =>
    Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next));
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!event.shiftKey || !["ArrowUp", "ArrowDown"].includes(event.key))
      return;
    event.preventDefault();
    onChange(clamp(value + (event.key === "ArrowUp" ? 10 : -10)));
  };
  return (
    <label>
      {label}
      <input
        type="number"
        name={`cohabitation-${label}`}
        value={Math.round(value)}
        min={min}
        max={max}
        step={1}
        onKeyDown={handleKeyDown}
        onChange={(event) => onChange(clamp(Number(event.target.value)))}
      />
    </label>
  );
}

interface Props {
  nodes: Node<FamilyNodeData>[];
  groups: Cohabitation[];
  labels: CohabitationLabel[];
  selectedGroupId: string | null;
  selectedLabelId: string | null;
  onSelectGroup(id: string): void;
  onSelectLabel(id: string): void;
  onCreateGroup(nodeIds: string[]): void;
  onUpdateGroup(id: string, input: Partial<Cohabitation>): void;
  onUpdateLabel(id: string, input: Partial<CohabitationLabel>): void;
  onDelete(): void;
}

export function CohabitationPanel({
  nodes,
  groups,
  labels,
  selectedGroupId,
  selectedLabelId,
  onSelectGroup,
  onSelectLabel,
  onCreateGroup,
  onUpdateGroup,
  onUpdateLabel,
  onDelete,
}: Props) {
  const [checkedNodeIds, setCheckedNodeIds] = useState<string[]>([]);
  const group = groups.find((item) => item.id === selectedGroupId);
  const label = labels.find((item) => item.id === selectedLabelId);
  const toggleNode = (nodeId: string) =>
    setCheckedNodeIds((current) =>
      current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId],
    );
  return (
    <section
      className="cohabitation-panel node-form"
      aria-labelledby="cohabitation-panel-title"
    >
      <h2 id="cohabitation-panel-title">同居要素</h2>
      <fieldset>
        <legend>人物を選んで同居輪を作成</legend>
        <div className="cohabitation-person-list">
          {nodes.map((node) => (
            <label key={node.id}>
              <input
                type="checkbox"
                checked={checkedNodeIds.includes(node.id)}
                onChange={() => toggleNode(node.id)}
              />
              {node.data.relationshipName}
              {node.data.memo ? ` — ${node.data.memo.slice(0, 14)}` : ""}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="button wide"
          disabled={checkedNodeIds.length < 2}
          aria-describedby="cohabitation-create-hint"
          onClick={() => {
            onCreateGroup(checkedNodeIds);
            setCheckedNodeIds([]);
          }}
        >
          選択した人物を同居輪で囲む
        </button>
        <small id="cohabitation-create-hint" className="field-hint">
          2人以上を選択してください。
        </small>
      </fieldset>
      {!!groups.length && (
        <label>
          同居輪を選択
          <select
            value={selectedGroupId || ""}
            onChange={(event) => onSelectGroup(event.target.value)}
          >
            <option value="">選択してください</option>
            {groups.map((item, index) => (
              <option key={item.id} value={item.id}>
                同居輪 {index + 1}
              </option>
            ))}
          </select>
        </label>
      )}
      {!!labels.length && (
        <label>
          同居文字を選択
          <select
            value={selectedLabelId || ""}
            onChange={(event) => onSelectLabel(event.target.value)}
          >
            <option value="">選択してください</option>
            {labels.map((item, index) => (
              <option key={item.id} value={item.id}>
                同居文字 {index + 1}
              </option>
            ))}
          </select>
        </label>
      )}
      {group && (
        <div className="cohabitation-fields">
          <NumericField
            label="文字サイズ"
            value={group.fontSize}
            min={8}
            max={48}
            onChange={(fontSize) => onUpdateGroup(group.id, { fontSize })}
          />
          <button
            type="button"
            className="button danger wide"
            onClick={onDelete}
          >
            同居輪を削除
          </button>
        </div>
      )}
      {label && (
        <div className="cohabitation-fields">
          <NumericField
            label="文字サイズ"
            value={label.fontSize}
            min={8}
            max={48}
            onChange={(fontSize) => onUpdateLabel(label.id, { fontSize })}
          />
          <button
            type="button"
            className="button danger wide"
            onClick={onDelete}
          >
            同居文字を削除
          </button>
        </div>
      )}
    </section>
  );
}
