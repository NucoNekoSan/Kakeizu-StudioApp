export * from "../../cohabitation";
import type { Cohabitation } from "../../cohabitation";
import type { Node } from "@xyflow/react";
import type { FamilyNodeData } from "../../familyGraph";
import { nodeSize } from "./nodeLayout";
export interface Point {
  x: number;
  y: number;
}

export function findNodeIdsInsidePolygon(
  points: readonly Point[],
  nodes: readonly Node<FamilyNodeData>[],
) {
  if (points.length < 3) return [];
  const isInside = ({ x, y }: Point) => {
    let hit = false;
    for (
      let index = 0, previous = points.length - 1;
      index < points.length;
      previous = index++
    ) {
      const currentPoint = points[index];
      const previousPoint = points[previous];
      if (
        currentPoint.y > y !== previousPoint.y > y &&
        x <
          ((previousPoint.x - currentPoint.x) * (y - currentPoint.y)) /
            (previousPoint.y - currentPoint.y) +
            currentPoint.x
      )
        hit = !hit;
    }
    return hit;
  };
  return nodes.flatMap((node) => {
    const size = nodeSize(node);
    return isInside({
      x: node.position.x + size.width / 2,
      y: node.position.y + size.height / 2,
    })
      ? [node.id]
      : [];
  });
}

export function createCohabitationFromNodes(
  nodes: readonly Node<FamilyNodeData>[],
  nodeIds: readonly string[],
): Cohabitation | null {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const members = nodeIds.flatMap((nodeId) => {
    const node = nodeById.get(nodeId);
    return node ? [node] : [];
  });
  if (members.length < 1) return null;
  const bounds = members.reduce(
    (box, node) => {
      const size = nodeSize(node);
      return {
        left: Math.min(box.left, node.position.x),
        top: Math.min(box.top, node.position.y),
        right: Math.max(box.right, node.position.x + size.width),
        bottom: Math.max(box.bottom, node.position.y + size.height),
      };
    },
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  );
  return {
    id: crypto.randomUUID(),
    nodeIds: members.map((node) => node.id),
    label: "同居",
    fontSize: 20,
    cx: (bounds.left + bounds.right) / 2,
    cy: (bounds.top + bounds.bottom) / 2,
    rx: Math.max(30, (bounds.right - bounds.left) / 2 + 36),
    ry: Math.max(30, (bounds.bottom - bounds.top) / 2 + 36),
  };
}
