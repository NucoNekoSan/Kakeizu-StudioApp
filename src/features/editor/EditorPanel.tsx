import type { Dispatch, SetStateAction } from "react";
import type { Node } from "@xyflow/react";
import { Plus, Settings as SettingsIcon } from "lucide-react";
import type { ChartDetail, ChartNodeRecord, Direction } from "../../types";
import type { FamilyNodeData } from "../../familyGraph";
import { Notice } from "../../components/ui";
import { getErrorMessage } from "../../domain";
import { NodeForm, QuickAddActions } from "./NodeForm";
import { CohabitationPanel } from "./CohabitationPanel";
import {
  createCohabitationFromNodes,
  type Cohabitation,
} from "./cohabitationModel";
import type { AddPreset, NodeDraft } from "./editorPresets";
import {
  BASE_NODE_WIDTH,
  BASE_NODE_HEIGHT,
  clampNodeToFrame,
} from "./nodeLayout";
import type { getPngFramePreview } from "./pngExport";
import type { useEditorPersistence } from "./useEditorPersistence";
import type { useCohabitationActions } from "./useCohabitationActions";
import { useTutorial } from "../tutorial/tutorialContext";

interface Props {
  detail: ChartDetail;
  nodes: Node<FamilyNodeData>[];
  selectedNode: Node<FamilyNodeData> | null;
  panel: "add" | "edit";
  setPanel: Dispatch<SetStateAction<"add" | "edit">>;
  addPreset: AddPreset | null;
  setAddPreset: Dispatch<SetStateAction<AddPreset | null>>;
  setConnectionPreview: Dispatch<
    SetStateAction<{ nodeId: string; direction: Direction | null } | null>
  >;
  setNodeDraft: Dispatch<SetStateAction<NodeDraft | null>>;
  pngFrame: ReturnType<typeof getPngFramePreview>;
  persistence: ReturnType<typeof useEditorPersistence>;
  actions: ReturnType<typeof useCohabitationActions>;
  reportCohabitation: (group: Cohabitation) => void;
  exportError: string;
}
export function EditorPanel({
  detail,
  nodes,
  selectedNode,
  panel,
  setPanel,
  addPreset,
  setAddPreset,
  setConnectionPreview,
  setNodeDraft,
  pngFrame,
  persistence,
  actions,
  reportCohabitation,
  exportError,
}: Props) {
  const id = detail.id;
  const tutorial = useTutorial();
  const {
    create,
    update,
    remove,
    cancelNodeUpdate: cancelDebouncedNodeUpdate,
  } = persistence;
  const {
    cohabitations,
    setCohabitations,
    cohabitationLabels,
    setCohabitationLabels,
  } = persistence.cohabitation;
  const {
    selectedCohabitation,
    setSelectedCohabitation,
    selectedLabel,
    setSelectedLabel,
    announcement,
    setAnnouncement,
    requestDeleteCohabitation,
  } = actions;
  const previewNodeDraft = setNodeDraft;
  const scheduleNodeUpdate = (input: Partial<Omit<ChartNodeRecord, "id">>) => {
    if (selectedNode) persistence.scheduleNodeUpdate(selectedNode.id, input);
  };
  return (
    <aside className="editor-panel" data-tutorial-target="add-person">
      <div className="panel-tabs">
        <button
          className={panel === "add" ? "active" : ""}
          onClick={() => {
            setPanel("add");
            setAddPreset(null);
            setConnectionPreview(null);
            setNodeDraft(null);
          }}
        >
          <Plus size={17} />
          追加
        </button>
        <button
          data-tutorial-target="edit-person"
          className={panel === "edit" ? "active" : ""}
          disabled={!selectedNode}
          onClick={() => setPanel("edit")}
        >
          <SettingsIcon size={17} />
          編集
        </button>
      </div>
      {panel === "add" ? (
        <NodeForm
          key={addPreset ? `${addPreset.kind}:${addPreset.anchorId}` : "root"}
          mode="add"
          detail={detail}
          nodes={nodes}
          preset={addPreset}
          onSubmit={(v) => {
            const position = clampNodeToFrame(
              { x: v.x, y: v.y },
              {
                width: BASE_NODE_WIDTH * v.scale,
                height: BASE_NODE_HEIGHT * v.scale,
              },
              pngFrame,
            );
            create.mutate(
              { ...v, ...position },
              {
                onSuccess: () => {
                  const kind = detail.relationships.find(
                    (item) => item.id === v.relationshipId,
                  )?.kind;
                  if (kind === "self")
                    tutorial.reportAction("self-created", id);
                  if (kind === "partner" || kind === "divorce")
                    tutorial.reportAction("partner-created", id);
                  if (kind === "child")
                    tutorial.reportAction("child-created", id);
                },
              },
            );
          }}
        />
      ) : (
        selectedNode && (
          <>
            <QuickAddActions
              node={selectedNode}
              onSelect={(kind) => {
                setAddPreset({ kind, anchorId: selectedNode.id });
                setPanel("add");
              }}
            />
            <NodeForm
              mode="edit"
              detail={detail}
              nodes={nodes}
              value={selectedNode}
              onConnectionPreview={(direction) =>
                setConnectionPreview({ nodeId: selectedNode.id, direction })
              }
              onDraftChange={previewNodeDraft}
              onChange={scheduleNodeUpdate}
              onSubmit={(v) =>
                update.mutate(
                  { chartId: id, nodeId: selectedNode.id, input: v },
                  {
                    onSuccess: () => tutorial.reportAction("person-edited", id),
                  },
                )
              }
              onDelete={() => {
                if (!confirm("このノードと接続線を削除しますか？")) return;
                cancelDebouncedNodeUpdate({
                  chartId: id,
                  nodeId: selectedNode.id,
                });
                remove.mutate(selectedNode.id);
              }}
            />
          </>
        )
      )}{" "}
      {persistence.error !== null && (
        <Notice tone="error">{getErrorMessage(persistence.error)}</Notice>
      )}
      {exportError && <Notice tone="error">{exportError}</Notice>}
      <p className="export-caution">
        書き出した画像・PDFには入力した氏名やメモがそのまま含まれます。保存先と共有範囲にご注意ください。
      </p>
      <CohabitationPanel
        nodes={nodes}
        groups={cohabitations}
        labels={cohabitationLabels}
        selectedGroupId={selectedCohabitation}
        selectedLabelId={selectedLabel}
        onSelectGroup={(groupId) => {
          setSelectedCohabitation(groupId);
          setSelectedLabel(null);
        }}
        onSelectLabel={(labelId) => {
          setSelectedLabel(labelId);
          setSelectedCohabitation(null);
        }}
        onCreateGroup={(nodeIds) => {
          const group = createCohabitationFromNodes(nodes, nodeIds);
          if (!group) return;
          setCohabitations((items) => [...items, group]);
          setSelectedCohabitation(group.id);
          setSelectedLabel(null);
          setAnnouncement("同居輪を作成しました");
          reportCohabitation(group);
        }}
        onUpdateGroup={(groupId, input) =>
          setCohabitations((items) =>
            items.map((item) =>
              item.id === groupId ? { ...item, ...input } : item,
            ),
          )
        }
        onUpdateLabel={(labelId, input) =>
          setCohabitationLabels((items) =>
            items.map((item) =>
              item.id === labelId ? { ...item, ...input } : item,
            ),
          )
        }
        onDelete={requestDeleteCohabitation}
      />
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
      <footer>
        <p>
          <b>{nodes.length}</b> ノード
        </p>
        <p>ドラッグして自由に配置</p>
      </footer>
    </aside>
  );
}
