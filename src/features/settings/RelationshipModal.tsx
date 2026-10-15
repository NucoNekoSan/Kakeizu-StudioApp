import { useState } from "react";
import type {
  LineStyle,
  RelationKind,
  RelationshipDefinition,
} from "../../types";
import { Modal, Notice } from "../../components/ui";
import { kindLabels, lineLabels } from "../../domain";

export function RelationshipModal({
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
