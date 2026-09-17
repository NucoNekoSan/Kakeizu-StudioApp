import { ShapeMark } from "../../components/ui";
import type { FamilyNodeData } from "../../familyGraph";
import { BASE_NODE_WIDTH } from "./nodeLayout";

export function FamilyNodeCard({
  data,
  selected = false,
}: {
  data: FamilyNodeData;
  selected?: boolean;
}) {
  return (
    <>
      <ShapeMark
        shape={data.shape}
        color={data.fillColor}
        textColor={data.textColor}
        label={data.genderName}
      />
      <div className={`family-node ${selected ? "selected" : ""}`}>
        <strong
          style={{
            fontSize: `${(data.relationshipFontSize / BASE_NODE_WIDTH) * 100}cqi`,
          }}
        >
          {data.relationshipName}
        </strong>
        <span className="gender-label">{data.genderName}</span>
        {data.memo && (
          <p
            /* nowheel は残す: メモは overflow-y:auto でスクロールするため、
               ホイールでキャンバスを拡大縮小せずメモを送れるようにする。
               nodrag は付けない: メモがカード中央を占めるため、付けると
               一番自然に掴む場所がドラッグの死角になる。ノード上のメモは
               表示専用で、編集は右パネルで行うので文字選択より移動を優先する。 */
            className="nowheel"
            style={{
              fontSize: `${(data.fontSize / BASE_NODE_WIDTH) * 100}cqi`,
            }}
          >
            {data.memo}
          </p>
        )}
      </div>
    </>
  );
}
