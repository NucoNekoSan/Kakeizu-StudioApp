import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { ChartDetail } from "../../types";
import type { FamilyNodeData } from "../../familyGraph";

export interface HydratedChart {
  readonly nodes: Node<FamilyNodeData>[];
  readonly edges: Edge[];
}

export function hydrateChart(
  detail: Pick<ChartDetail, "nodes" | "edges" | "relationships" | "genders">,
): HydratedChart {
  const relationshipsById = new Map(
    detail.relationships.map((item) => [item.id, item]),
  );
  const gendersById = new Map(detail.genders.map((item) => [item.id, item]));
  const nodesById = new Map(detail.nodes.map((item) => [item.id, item]));

  return {
    nodes: detail.nodes.map((node) => {
      const relationship = relationshipsById.get(node.relationshipId);
      const gender = gendersById.get(node.genderId);
      return {
        id: node.id,
        type: "family",
        position: { x: node.x, y: node.y },
        width: 180 * node.scale,
        data: {
          relationshipId: node.relationshipId,
          relationshipName: relationship?.name || "未設定",
          relationKind: relationship?.kind || "other",
          lineStyle: relationship?.lineStyle || "solid",
          lineColor: relationship?.lineColor || "#52645e",
          genderId: node.genderId,
          genderName: gender?.name || "未設定",
          shape: gender?.shape || "circle",
          fillColor: gender?.fillColor || "#6b7772",
          textColor: gender?.textColor || "#fff",
          memo: node.memo,
          fontSize: node.fontSize,
          relationshipFontSize: node.relationshipFontSize,
          scale: node.scale,
          anchorNodeId: node.anchorNodeId,
          parentNodeId1: node.parentNodeId1,
          parentNodeId2: node.parentNodeId2,
          placementDirection: node.placementDirection,
          connectionDirection: node.connectionDirection,
          divorced: node.divorced,
        },
      };
    }),
    edges: detail.edges.map((edge) => {
      const source = nodesById.get(edge.source),
        target = nodesById.get(edge.target),
        relationshipNode = [source, target].find(
          (node) =>
            node &&
            (node.anchorNodeId === edge.source ||
              node.anchorNodeId === edge.target) &&
            ["partner", "divorce"].includes(
              relationshipsById.get(node.relationshipId)?.kind || "",
            ),
        );
      const isDivorced =
        edge.relationKind === "partner" && relationshipNode?.divorced;
      const relationKind = isDivorced ? "divorce" : edge.relationKind;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "family",
        data: { relationKind, relationshipId: edge.relationshipId },
        style: {
          stroke: edge.lineColor,
          strokeWidth: 2,
          strokeDasharray:
            edge.lineStyle === "dashed"
              ? "9 6"
              : edge.lineStyle === "dotted"
                ? "2 6"
                : undefined,
        },
        markerEnd:
          relationKind === "partner" || relationKind === "divorce"
            ? undefined
            : {
                type: MarkerType.ArrowClosed,
                color: edge.lineColor,
                width: 12,
                height: 12,
              },
      };
    }),
  };
}
