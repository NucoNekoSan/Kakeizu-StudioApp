import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
  ViewportPortal,
} from "@xyflow/react";
import {
  ArrowLeft,
  Download,
  FileImage,
  Lasso,
  Plus,
  Save,
  Settings as SettingsIcon,
  Users,
  Type,
} from "lucide-react";
import { api } from "../../api";
import type { ChartDetail, ChartNodeRecord, Direction } from "../../types";
import { type FamilyNodeData } from "../../familyGraph";

import { Logo, Notice, Shell, Spinner } from "../../components/ui";
import {
  GuidanceActions,
  ResourceActions,
} from "../../components/HeaderActions";
import { getErrorMessage } from "../../domain";
import { hydrateChart } from "./hydrateChart";
import { type AddPreset, type NodeDraft } from "./editorPresets";
import { useEditorPreview } from "./useEditorPreview";
import { FamilyEdge } from "./FamilyEdge";
import { FamilyTreeEdge } from "./FamilyTreeEdge";
import { useNodeResize } from "./useNodeResize";
import { useChartTitleSave } from "./useChartTitleSave";
import { useChartNodeMutations } from "./useChartNodeMutations";
import { useDebouncedNodeUpdate } from "./useDebouncedNodeUpdate";
import { useCohabitationDocument } from "./useCohabitationDocument";
import { createCohabitationFromNodes } from "./cohabitationModel";
import { CohabitationPanel } from "./CohabitationPanel";
import { CohabitationLayer } from "./CohabitationLayer";
import { CohabitationToolOverlay } from "./CohabitationToolOverlay";
import { NodeForm, QuickAddActions } from "./NodeForm";
import { FamilyNode } from "./FamilyNode";
import { ResizeContext } from "./resizeContext";
import { DEFAULT_FRAME_HEIGHT, DEFAULT_FRAME_WIDTH } from "../../frameSettings";
import { FrameSettings } from "./FrameSettings";
import { readFrameVisibility, writeFrameVisibility } from "./frameVisibility";
import { getPngFramePreview } from "./pngExport";
import { PNG_FRAME } from "./pngExport";
import { PngPreviewDialog } from "./PngPreviewDialog";
import { usePngExport } from "./usePngExport";
import {
  BASE_NODE_HEIGHT,
  BASE_NODE_WIDTH,
  clampNodeToFrame,
  nodeSize,
} from "./nodeLayout";
import EditorTutorial from "./EditorTutorial";

const nodeTypes = { family: FamilyNode },
  edgeTypes = { family: FamilyEdge, familyTree: FamilyTreeEdge };
function ChartEditor() {
  const { id = "" } = useParams(),
    nav = useNavigate(),
    qc = useQueryClient(),
    flowRef = useRef<HTMLDivElement>(null),
    flow = useRef<ReactFlowInstance<Node<FamilyNodeData>, Edge> | null>(null),
    chart = useQuery({ queryKey: ["chart", id], queryFn: () => api.chart(id) }),
    [nodes, setNodes, onNodesChange] = useNodesState<Node<FamilyNodeData>>([]),
    [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]),
    [selected, setSelected] = useState<string | null>(null),
    [panel, setPanel] = useState<"add" | "edit">("add"),
    [addPreset, setAddPreset] = useState<AddPreset | null>(null),
    [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved"),
    [announcement, setAnnouncement] = useState(""),
    [nodeDraft, setNodeDraft] = useState<NodeDraft | null>(null),
    [frameVisible, setFrameVisible] = useState(readFrameVisibility),
    [lassoMode, setLassoMode] = useState(false),
    [labelMode, setLabelMode] = useState(false),
    [tutorialOpen, setTutorialOpen] = useState(false),
    tutorialButtonRef = useRef<HTMLButtonElement>(null),
    {
      cohabitations,
      setCohabitations,
      cohabitationLabels,
      setCohabitationLabels,
      storageError: cohabitationStorageError,
      isHydrated: isCohabitationHydrated,
    } = useCohabitationDocument(id),
    [selectedCohabitation, setSelectedCohabitation] = useState<string | null>(
      null,
    ),
    [selectedLabel, setSelectedLabel] = useState<string | null>(null),
    titleInput = useRef<HTMLInputElement>(null),
    [connectionPreview, setConnectionPreview] = useState<{
      nodeId: string;
      direction: Direction | null;
    } | null>(null);
  useEffect(() => {
    if (chart.data) {
      const h = hydrateChart(chart.data);
      setNodes(h.nodes);
      setEdges(h.edges);
    }
  }, [chart.data, setNodes, setEdges]);
  useEffect(() => {
    setSelectedCohabitation(null);
    setSelectedLabel(null);
    setAnnouncement("");
  }, [id]);
  useEffect(() => {
    if (!chart.data || !isCohabitationHydrated) return;
    const validNodeIds = new Set(chart.data.nodes.map((node) => node.id));
    const next = cohabitations.flatMap((group) => {
      const nodeIds = group.nodeIds.filter((nodeId) =>
        validNodeIds.has(nodeId),
      );
      if (nodeIds.length < 2) return [];
      return nodeIds.length === group.nodeIds.length
        ? [group]
        : [{ ...group, nodeIds }];
    });
    if (
      next.length !== cohabitations.length ||
      next.some((group, index) => group !== cohabitations[index])
    )
      setCohabitations(next);
  }, [chart.data, cohabitations, isCohabitationHydrated, setCohabitations]);
  const requestDeleteCohabitation = useCallback(() => {
    const message = selectedCohabitation
      ? "この同居輪を削除しますか？"
      : "この同居文字を削除しますか？";
    if ((!selectedCohabitation && !selectedLabel) || !confirm(message)) return;
    if (selectedCohabitation)
      setCohabitations((items) =>
        items.filter((item) => item.id !== selectedCohabitation),
      );
    if (selectedLabel)
      setCohabitationLabels((items) =>
        items.filter((item) => item.id !== selectedLabel),
      );
    setSelectedCohabitation(null);
    setSelectedLabel(null);
    setAnnouncement(
      selectedCohabitation ? "同居輪を削除しました" : "同居文字を削除しました",
    );
  }, [
    selectedCohabitation,
    selectedLabel,
    setCohabitationLabels,
    setCohabitations,
  ]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (!selectedCohabitation && !selectedLabel) ||
        !["Delete", "Backspace"].includes(event.key)
      )
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      )
        return;
      event.preventDefault();
      requestDeleteCohabitation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestDeleteCohabitation, selectedCohabitation, selectedLabel]);
  const refresh = (d: ChartDetail) => {
    qc.setQueryData(["chart", id], d);
    const h = hydrateChart(d);
    setNodes(h.nodes);
    setEdges(h.edges);
    setConnectionPreview(null);
    setNodeDraft(null);
  };
  const { create, update, remove, frame } = useChartNodeMutations(
    id,
    refresh,
    setSaveState,
    () => {
      setSelected(null);
      setPanel("add");
    },
  );
  const titleSave = useChartTitleSave(id);
  const {
    schedule: scheduleDebouncedNodeUpdate,
    flush: flushDebouncedNodeUpdate,
    cancelTarget: cancelDebouncedNodeUpdate,
  } = useDebouncedNodeUpdate((request) => update.mutate(request));
  const scheduleNodeUpdate = useCallback(
    (input: Partial<Omit<ChartNodeRecord, "id">>) => {
      if (!selected) return;
      scheduleDebouncedNodeUpdate({ chartId: id, nodeId: selected, input });
    },
    [id, scheduleDebouncedNodeUpdate, selected],
  );
  const saveChanges = useCallback(() => {
    flushDebouncedNodeUpdate();
    const title = titleInput.current?.value.trim();
    if (title && title !== chart.data?.title) titleSave.mutate(title);
  }, [chart.data?.title, flushDebouncedNodeUpdate, titleSave]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s" || (!event.ctrlKey && !event.metaKey))
        return;
      event.preventDefault();
      saveChanges();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveChanges]);
  const { display, pngFrame } = useEditorPreview(
      nodes,
      edges,
      connectionPreview,
      nodeDraft,
      chart.data?.frameWidth ?? DEFAULT_FRAME_WIDTH,
      chart.data?.frameHeight ?? DEFAULT_FRAME_HEIGHT,
    ),
    {
      exportPng,
      previewPng,
      preview,
      closePreview,
      savePreview,
      exportError,
      isExporting,
    } = usePngExport(
      flowRef,
      display.nodes,
      chart.data?.title,
      chart.data?.frameWidth ?? DEFAULT_FRAME_WIDTH,
      chart.data?.frameHeight ?? DEFAULT_FRAME_HEIGHT,
    ),
    resizeActions = useNodeResize(nodes, pngFrame, (nodeId, input) =>
      update.mutate({ chartId: id, nodeId, input }),
    );
  const displayNodeById = useMemo(
    () => new Map(display.nodes.map((node) => [node.id, node])),
    [display.nodes],
  );
  const previewNodeDraft = useCallback((draft: NodeDraft | null) => {
    setNodeDraft(draft);
  }, []);
  const screenToFlowPosition = useCallback(
    (position: { x: number; y: number }) =>
      flow.current?.screenToFlowPosition(position),
    [],
  );
  if (chart.isLoading) return <Spinner />;
  if (chart.isError || !chart.data)
    return (
      <Shell>
        <main className="page">
          <Notice tone="error">{getErrorMessage(chart.error)}</Notice>
        </main>
      </Shell>
    );
  const selectedNode = nodes.find((n) => n.id === selected) || null;
  return (
    <div className="editor-shell">
      <EditorTutorial
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        returnFocusRef={tutorialButtonRef}
      />
      <PngPreviewDialog
        preview={preview}
        onClose={closePreview}
        onSave={savePreview}
        isSaving={isExporting}
        error={exportError}
      />
      <header className="editor-topbar">
        <div className="editor-heading" data-tutorial-target="editor-basics">
          <button
            className="icon"
            onClick={() => nav("/charts")}
            aria-label="一覧へ戻る"
          >
            <ArrowLeft />
          </button>
          <Logo />
          <span className="top-divider" />
          <input
            ref={titleInput}
            className="title-input"
            aria-label="相関図タイトル"
            defaultValue={chart.data.title}
            onBlur={(e) =>
              e.target.value.trim() &&
              e.target.value !== chart.data?.title &&
              titleSave.mutate(e.target.value.trim())
            }
          />
          <div
            className={`save-state ${saveState}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <Save size={14} />
            {saveState === "saving"
              ? "保存中"
              : saveState === "error"
                ? "保存失敗"
                : "保存済み"}
          </div>
        </div>
        <GuidanceActions
          onStartTutorial={() => setTutorialOpen(true)}
          tutorialButtonRef={tutorialButtonRef}
        />
        <div className="editor-actions">
          <ResourceActions />
          <FrameSettings
            visible={frameVisible}
            width={chart.data.frameWidth ?? DEFAULT_FRAME_WIDTH}
            height={chart.data.frameHeight ?? DEFAULT_FRAME_HEIGHT}
            isSaving={frame.isPending}
            error={frame.error ? getErrorMessage(frame.error) : ""}
            willMove={(width, height) => {
              const bounds = getPngFramePreview(nodes, width, height);
              return nodes.some((node) => {
                const position = clampNodeToFrame(
                  node.position,
                  nodeSize(node),
                  bounds,
                );
                return (
                  position.x !== node.position.x ||
                  position.y !== node.position.y
                );
              });
            }}
            onApply={async (visible, width, height) => {
              frame.reset();
              if (
                width !== (chart.data?.frameWidth ?? DEFAULT_FRAME_WIDTH) ||
                height !== (chart.data?.frameHeight ?? DEFAULT_FRAME_HEIGHT)
              ) {
                flushDebouncedNodeUpdate();
                const bounds = getPngFramePreview(nodes, width, height);
                const layouts = nodes.map((node) => ({
                  id: node.id,
                  scale: node.data.scale,
                  ...clampNodeToFrame(node.position, nodeSize(node), bounds),
                }));
                await frame.mutateAsync({ width, height, layouts });
              }
              writeFrameVisibility(visible);
              setFrameVisible(visible);
            }}
          />
          <button className="button" onClick={() => nav("/settings")}>
            <SettingsIcon size={17} />
            <span className="button-label">表示設定</span>
          </button>
          <button
            className={`button ${lassoMode ? "active" : ""}`}
            data-tutorial-target="cohabitation"
            onClick={() => {
              setLassoMode((active) => !active);
              setLabelMode(false);
            }}
            aria-pressed={lassoMode}
          >
            <Lasso size={17} />
            <span className="button-label">同居輪</span>
          </button>
          <button
            className={`button ${labelMode ? "active" : ""}`}
            onClick={() => {
              setLabelMode((active) => !active);
              setLassoMode(false);
            }}
            aria-pressed={labelMode}
          >
            <Type size={17} aria-hidden="true" />
            <span className="button-label">同居文字</span>
          </button>
          {selectedCohabitation && (
            <button
              className="button danger"
              onClick={requestDeleteCohabitation}
            >
              同居輪を削除
            </button>
          )}
          <button
            className="button"
            onClick={previewPng}
            disabled={isExporting || frame.isPending}
          >
            <FileImage size={17} aria-hidden="true" />
            <span className="button-label">
              {isExporting ? "PNG作成中…" : "PNGプレビュー"}
            </span>
          </button>
          <button
            className="button primary"
            onClick={exportPng}
            disabled={isExporting || frame.isPending}
            title="画像には入力した氏名やメモがそのまま含まれます"
          >
            <Download size={17} />
            <span className="button-label">
              {isExporting ? "PNG作成中…" : "PNG保存"}
            </span>
          </button>
        </div>
      </header>
      <main className="editor-body">
        <aside className="editor-panel">
          <div className="panel-tabs" data-tutorial-target="add-person">
            <button
              data-tutorial-target="edit-person"
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
              key={
                addPreset ? `${addPreset.kind}:${addPreset.anchorId}` : "root"
              }
              mode="add"
              detail={chart.data}
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
                create.mutate({ ...v, ...position });
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
                  detail={chart.data}
                  nodes={nodes}
                  value={selectedNode}
                  onConnectionPreview={(direction) =>
                    setConnectionPreview({ nodeId: selectedNode.id, direction })
                  }
                  onDraftChange={previewNodeDraft}
                  onChange={scheduleNodeUpdate}
                  onSubmit={(v) =>
                    update.mutate({
                      chartId: id,
                      nodeId: selectedNode.id,
                      input: v,
                    })
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
          {(create.error || update.error) && (
            <Notice tone="error">
              {getErrorMessage(create.error || update.error)}
            </Notice>
          )}
          {exportError && <Notice tone="error">{exportError}</Notice>}
          <p className="export-caution">
            PNGには入力した氏名やメモがそのまま含まれます。保存先と共有範囲にご注意ください。
          </p>
          {cohabitationStorageError && (
            <Notice tone="error">
              同居要素をこの端末に保存できません。ブラウザの保存設定を確認してください。
            </Notice>
          )}
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
        <section
          className="flow-wrap"
          ref={flowRef}
          data-tutorial-target="canvas"
        >
          <CohabitationToolOverlay
            lassoMode={lassoMode}
            labelMode={labelMode}
            nodes={nodes}
            screenToFlowPosition={(event) =>
              screenToFlowPosition({ x: event.clientX, y: event.clientY })
            }
            onSetCohabitations={setCohabitations}
            onSetLabels={setCohabitationLabels}
            onSelectCohabitation={setSelectedCohabitation}
            onSelectLabel={setSelectedLabel}
            onFinishLasso={() => setLassoMode(false)}
            onFinishLabel={() => setLabelMode(false)}
          />
          <ResizeContext.Provider value={resizeActions}>
            <ReactFlow
              nodes={display.nodes}
              edges={display.edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={(changes) =>
                onNodesChange(
                  changes.filter(
                    (c) =>
                      !("id" in c) ||
                      (!c.id.startsWith("union:") && !c.id.startsWith("hub:")),
                  ),
                )
              }
              onEdgesChange={onEdgesChange}
              onInit={(v) => {
                flow.current = v as ReactFlowInstance<
                  Node<FamilyNodeData>,
                  Edge
                >;
                setTimeout(() => v.fitView({ padding: 0.2 }), 60);
              }}
              onNodeClick={(_, n) => {
                if (n.type !== "family") return;
                setConnectionPreview(null);
                setSelected(n.id);
                setAddPreset(null);
                setPanel("edit");
              }}
              onPaneClick={() => {
                setConnectionPreview(null);
                setNodeDraft(null);
                setSelected(null);
              }}
              onNodeDrag={(_, n) => {
                if (n.type === "family") {
                  const position = clampNodeToFrame(
                    n.position,
                    nodeSize(n),
                    pngFrame,
                  );
                  if (
                    position.x !== n.position.x ||
                    position.y !== n.position.y
                  )
                    setNodes((current) =>
                      current.map((node) =>
                        node.id === n.id ? { ...node, position } : node,
                      ),
                    );
                }
              }}
              onNodeDragStop={(_, n) => {
                if (n.type !== "family") return;
                const position = clampNodeToFrame(
                  n.position,
                  nodeSize(n),
                  pngFrame,
                );
                update.mutate({ chartId: id, nodeId: n.id, input: position });
              }}
              minZoom={0.3}
              maxZoom={2}
              fitView
            >
              <Background color="#c7cdc8" gap={24} size={1} />
              {frameVisible && pngFrame && (
                <ViewportPortal>
                  <svg
                    className="png-frame-preview"
                    aria-hidden="true"
                    width={pngFrame.width}
                    height={pngFrame.height}
                    style={{
                      transform: `translate(${pngFrame.x}px, ${pngFrame.y}px)`,
                    }}
                  >
                    <rect
                      width={pngFrame.width}
                      height={pngFrame.height}
                      rx={pngFrame.radius}
                      fill="none"
                      stroke={PNG_FRAME.color}
                      strokeWidth={pngFrame.strokeWidth}
                      strokeDasharray={pngFrame.dash.join(" ")}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </ViewportPortal>
              )}
              <CohabitationLayer
                groups={cohabitations}
                labels={cohabitationLabels}
                nodesById={displayNodeById}
                selectedGroupId={selectedCohabitation}
                selectedLabelId={selectedLabel}
                screenToFlowPosition={screenToFlowPosition}
                onSetGroups={setCohabitations}
                onSetLabels={setCohabitationLabels}
                onSelectGroup={(groupId) => {
                  setSelectedCohabitation(groupId);
                  if (groupId) setSelectedLabel(null);
                }}
                onSelectLabel={(labelId) => {
                  setSelectedLabel(labelId);
                  if (labelId) setSelectedCohabitation(null);
                }}
              />
              <MiniMap
                nodeColor={(n) =>
                  (n.data as Partial<FamilyNodeData>).fillColor || "#52645e"
                }
                maskColor="rgba(244,242,235,.72)"
              />
              <Controls position="bottom-right" />
            </ReactFlow>
          </ResizeContext.Provider>
          {!nodes.length && (
            <div className="flow-empty">
              <div>
                <Users />
              </div>
              <h2>最初のノードを追加</h2>
              <p>左側で続柄と性別を選ぶと、ここに相関図が始まります。</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default ChartEditor;
