import { useState } from "react";
import type { GenderDefinition, Shape } from "../../types";
import { Modal, Notice } from "../../components/ui";

export function GenderModal({
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
