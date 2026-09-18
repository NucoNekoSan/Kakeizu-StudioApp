import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import { buildFamilyGraph, type FamilyNodeData } from "../../familyGraph";
import { getPngFramePreview } from "./pngExport";
import type { NodeDraft } from "./editorPresets";

export function useEditorPreview(
  nodes: Node<FamilyNodeData>[],
  edges: Edge[],
  connectionPreview: {
    nodeId: string;
    direction: FamilyNodeData["connectionDirection"];
  } | null,
  nodeDraft: NodeDraft | null,
  frameWidth?: number,
  frameHeight?: number,
) {
  const display = useMemo(
    () =>
      buildFamilyGraph(
        nodes.map((node) => {
          const connectionDirection =
              connectionPreview?.nodeId === node.id
                ? connectionPreview.direction
                : node.data.connectionDirection,
            draft = nodeDraft?.nodeId === node.id ? nodeDraft : null;
          if (!draft && connectionDirection === node.data.connectionDirection)
            return node;
          return {
            ...node,
            data: {
              ...node.data,
              connectionDirection,
              ...(draft
                ? {
                    memo: draft.memo,
                    fontSize: draft.fontSize,
                    relationshipFontSize: draft.relationshipFontSize,
                  }
                : {}),
            },
          };
        }),
        edges,
      ),
    [nodes, edges, connectionPreview, nodeDraft],
  );
  const pngFrame = useMemo(
    () => getPngFramePreview(display.nodes, frameWidth, frameHeight),
    [display.nodes, frameWidth, frameHeight],
  );
  return { display, pngFrame };
}
