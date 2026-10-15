import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { Users } from "lucide-react";
import { api } from "../../api";
import type { Direction } from "../../types";
import { type FamilyNodeData } from "../../familyGraph";

import { Notice, Shell, Spinner } from "../../components/ui";

import { getErrorMessage } from "../../domain";
import { hydrateChart } from "./hydrateChart";
import { type AddPreset, type NodeDraft } from "./editorPresets";
import { useEditorPreview } from "./useEditorPreview";
import { FamilyEdge } from "./FamilyEdge";
import { FamilyTreeEdge } from "./FamilyTreeEdge";
import { useNodeResize } from "./useNodeResize";
import { type Cohabitation } from "./cohabitationModel";
import { CohabitationLayer } from "./CohabitationLayer";
import { CohabitationToolOverlay } from "./CohabitationToolOverlay";
import { FamilyNode } from "./FamilyNode";
import { ResizeContext } from "./resizeContext";
import { DEFAULT_FRAME_HEIGHT, DEFAULT_FRAME_WIDTH } from "../../frameSettings";
import { readFrameVisibility } from "./frameVisibility";
import { PNG_FRAME } from "./pngExport";
import { PngPreviewDialog } from "./PngPreviewDialog";
import { ExportFileDialog } from "./ExportFileDialog";
import { usePngExport } from "./usePngExport";
import { clampNodeToFrame, nodeSize } from "./nodeLayout";
import { prepareFileSave, saveJsonFile } from "../../storage/fileIo";
import { chartBackupFileName } from "../../storage/backupModel";
import { EditorToolbar } from "./EditorToolbar";
import { EditorPanel } from "./EditorPanel";
import { useCohabitationActions } from "./useCohabitationActions";
import { useEditorPersistence } from "./useEditorPersistence";
import { useTutorial } from "../tutorial/tutorialContext";

const nodeTypes = { family: FamilyNode },
  edgeTypes = { family: FamilyEdge, familyTree: FamilyTreeEdge };
function ChartEditor() {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { id = "" } = useParams(),
    tutorial = useTutorial(),
    flowRef = useRef<HTMLDivElement>(null),
    flow = useRef<ReactFlowInstance<Node<FamilyNodeData>, Edge> | null>(null),
    chart = useQuery({ queryKey: ["chart", id], queryFn: () => api.chart(id) }),
    [nodes, setNodes, onNodesChange] = useNodesState<Node<FamilyNodeData>>([]),
    [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]),
    [selected, setSelected] = useState<string | null>(null),
    [panel, setPanel] = useState<"add" | "edit">("add"),
    [addPreset, setAddPreset] = useState<AddPreset | null>(null),
    [nodeDraft, setNodeDraft] = useState<NodeDraft | null>(null),
    [frameVisible, setFrameVisible] = useState(readFrameVisibility),
    [isJsonExporting, setIsJsonExporting] = useState(false),
    [connectionPreview, setConnectionPreview] = useState<{
      nodeId: string;
      direction: Direction | null;
    } | null>(null);
  const persistence = useEditorPersistence(id, chart.data, () => {
    setSelected(null);
    setPanel("add");
  });
  const { update, flushAndWait } = persistence;
  const {
    cohabitations,
    setCohabitations,
    cohabitationLabels,
    setCohabitationLabels,
  } = persistence.cohabitation;
  const cohabitationActions = useCohabitationActions(
    chart.data,
    persistence.cohabitation,
  );
  const {
    selectedCohabitation,
    setSelectedCohabitation,
    selectedLabel,
    setSelectedLabel,
    lassoMode,
    setLassoMode,
    labelMode,
    setLabelMode,
    setAnnouncement,
  } = cohabitationActions;
  const reportCohabitation = useCallback(
    (group: Cohabitation) => {
      if (group.nodeIds.length >= 2) {
        tutorial.reportAction("multi-cohabitation-created", id);
        return;
      }
      const member =
        group.nodeIds.length === 1
          ? nodes.find((node) => node.id === group.nodeIds[0])
          : null;
      if (member?.data.relationKind === "self")
        tutorial.reportAction("single-self-cohabitation-created", id);
    },
    [id, nodes, tutorial],
  );
  useEffect(() => {
    if (nodes.some((node) => node.data.relationKind === "self"))
      tutorial.reportAction("self-created", id);
    if (
      nodes.some(
        (node) =>
          node.data.relationKind === "partner" ||
          node.data.relationKind === "divorce",
      )
    )
      tutorial.reportAction("partner-created", id);
    if (nodes.some((node) => node.data.relationKind === "child"))
      tutorial.reportAction("child-created", id);
    if (
      cohabitations.some(
        (group) =>
          group.nodeIds.length === 1 &&
          nodes.find((node) => node.id === group.nodeIds[0])?.data
            .relationKind === "self",
      )
    )
      tutorial.reportAction("single-self-cohabitation-created", id);
    if (cohabitations.some((group) => group.nodeIds.length >= 2))
      tutorial.reportAction("multi-cohabitation-created", id);
    if (cohabitationLabels.length)
      tutorial.reportAction("cohabitation-label-created", id);
  }, [cohabitationLabels.length, cohabitations, id, nodes, tutorial]);
  const storedNodes = chart.data?.nodes,
    storedEdges = chart.data?.edges,
    relationships = chart.data?.relationships,
    genders = chart.data?.genders;
  useEffect(() => {
    if (storedNodes && storedEdges && relationships && genders) {
      const h = hydrateChart({
        nodes: storedNodes,
        edges: storedEdges,
        relationships,
        genders,
      });
      setNodes(h.nodes);
      setEdges(h.edges);
    }
  }, [storedNodes, storedEdges, relationships, genders, setNodes, setEdges]);
  const exportCurrentChart = useCallback(async () => {
    setIsJsonExporting(true);
    try {
      const suggestedName = chartBackupFileName(
        persistence.titleValue.trim() || chart.data?.title || "相関図",
      );
      // Open the picker during the click, before waiting for storage writes.
      const target = await prepareFileSave(suggestedName, {
        description: "JSONファイル",
        mimeType: "application/json",
        extension: ".json",
      });
      if (!target) return;
      await flushAndWait();
      const { fileName, json } = await api.createChartBackup(id);
      const saved = await saveJsonFile(fileName, json, target);
      if (saved) {
        setAnnouncement(`${fileName} を書き出しました。`);
        tutorial.reportAction("json-exported", id);
      }
    } catch (caught) {
      setAnnouncement(
        `JSONファイルを書き出せませんでした。${getErrorMessage(caught)}`,
      );
    } finally {
      setIsJsonExporting(false);
    }
  }, [
    flushAndWait,
    id,
    tutorial,
    setAnnouncement,
    persistence.titleValue,
    chart.data?.title,
  ]);
  const { display, pngFrame } = useEditorPreview(
      nodes,
      edges,
      connectionPreview,
      nodeDraft,
      chart.data?.frameWidth ?? DEFAULT_FRAME_WIDTH,
      chart.data?.frameHeight ?? DEFAULT_FRAME_HEIGHT,
    ),
    {
      exportFile,
      previewPng,
      preview,
      closePreview,
      exportError,
      isExporting,
    } = usePngExport(
      flowRef,
      display.nodes,
      chart.data?.title,
      chart.data?.frameWidth ?? DEFAULT_FRAME_WIDTH,
      chart.data?.frameHeight ?? DEFAULT_FRAME_HEIGHT,
      {
        beforeGenerate: flushAndWait,
        onPreviewCreated: () => tutorial.reportAction("overview-previewed", id),
        onSaved: () => tutorial.reportAction("file-exported", id),
      },
    ),
    resizeActions = useNodeResize(nodes, pngFrame, (nodeId, input) =>
      update.mutate({ chartId: id, nodeId, input }),
    );
  const displayNodeById = useMemo(
    () => new Map(display.nodes.map((node) => [node.id, node])),
    [display.nodes],
  );
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
      <ExportFileDialog
        open={exportDialogOpen}
        isSaving={isExporting}
        error={exportError}
        onClose={() => setExportDialogOpen(false)}
        onSave={async (format) => {
          if (await exportFile(format)) setExportDialogOpen(false);
        }}
      />
      <PngPreviewDialog
        preview={preview}
        onClose={closePreview}
        error={exportError}
      />
      <EditorToolbar
        detail={chart.data}
        nodes={nodes}
        persistence={persistence}
        actions={cohabitationActions}
        frameVisible={frameVisible}
        setFrameVisible={setFrameVisible}
        isExporting={isExporting}
        previewPng={previewPng}
        onOpenExport={() => setExportDialogOpen(true)}
        exportCurrentChart={exportCurrentChart}
        isJsonExporting={isJsonExporting}
      />
      <main className="editor-body">
        <EditorPanel
          detail={chart.data}
          nodes={nodes}
          selectedNode={selectedNode}
          panel={panel}
          setPanel={setPanel}
          addPreset={addPreset}
          setAddPreset={setAddPreset}
          setConnectionPreview={setConnectionPreview}
          setNodeDraft={setNodeDraft}
          pngFrame={pngFrame}
          persistence={persistence}
          actions={cohabitationActions}
          reportCohabitation={reportCohabitation}
          exportError={exportError}
        />
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
            onCreateCohabitation={(group) => {
              setAnnouncement("同居輪を作成しました");
              reportCohabitation(group);
            }}
            onCreateLabel={() => {
              setAnnouncement("同居文字を作成しました");
              tutorial.reportAction("cohabitation-label-created", id);
            }}
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
                update.mutate(
                  { chartId: id, nodeId: n.id, input: position },
                  {
                    onSuccess: () => tutorial.reportAction("node-arranged", id),
                  },
                );
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

export default function ChartEditorRoute() {
  const { id } = useParams();
  return <ChartEditor key={id} />;
}
