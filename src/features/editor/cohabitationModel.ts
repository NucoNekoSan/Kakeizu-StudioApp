export const COHABITATION_DOCUMENT_VERSION = 1 as const;

export interface Cohabitation {
  id: string;
  nodeIds: string[];
  label: string;
  fontSize: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  labelX?: number;
  labelY?: number;
}

export interface CohabitationLabel {
  id: string;
  x: number;
  y: number;
  fontSize: number;
}

export interface CohabitationDocumentV1 {
  version: typeof COHABITATION_DOCUMENT_VERSION;
  cohabitations: Cohabitation[];
  labels: CohabitationLabel[];
}

export type CohabitationDocument = CohabitationDocumentV1;

export const emptyCohabitationDocument = (): CohabitationDocument => ({
  version: COHABITATION_DOCUMENT_VERSION,
  cohabitations: [],
  labels: [],
});

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

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function isCohabitation(value: unknown): value is Cohabitation {
  if (!record(value)) return false;
  return (
    text(value.id) &&
    value.id.length > 0 &&
    Array.isArray(value.nodeIds) &&
    value.nodeIds.length >= 1 &&
    value.nodeIds.every(text) &&
    new Set(value.nodeIds).size === value.nodeIds.length &&
    text(value.label) &&
    finite(value.fontSize) &&
    value.fontSize >= 8 &&
    value.fontSize <= 48 &&
    finite(value.cx) &&
    finite(value.cy) &&
    finite(value.rx) &&
    finite(value.ry) &&
    value.rx >= 30 &&
    value.ry >= 30 &&
    (value.labelX === undefined || finite(value.labelX)) &&
    (value.labelY === undefined || finite(value.labelY))
  );
}

export function isCohabitationLabel(
  value: unknown,
): value is CohabitationLabel {
  return (
    record(value) &&
    text(value.id) &&
    value.id.length > 0 &&
    finite(value.x) &&
    finite(value.y) &&
    finite(value.fontSize) &&
    value.fontSize >= 8 &&
    value.fontSize <= 48
  );
}

export function isCohabitationDocument(
  value: unknown,
): value is CohabitationDocument {
  return (
    record(value) &&
    value.version === COHABITATION_DOCUMENT_VERSION &&
    Array.isArray(value.cohabitations) &&
    value.cohabitations.every(isCohabitation) &&
    Array.isArray(value.labels) &&
    value.labels.every(isCohabitationLabel)
  );
}

export function parseCohabitationDocument(
  value: unknown,
): CohabitationDocument | null {
  return isCohabitationDocument(value) ? value : null;
}
import type { Node } from "@xyflow/react";
import type { FamilyNodeData } from "../../familyGraph";
import { nodeSize } from "./nodeLayout";
