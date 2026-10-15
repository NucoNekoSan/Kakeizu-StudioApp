import type { ChartNodeRecord } from "../types";

export function parentPairIssue(first: string | null, second: string | null) {
  if (first === null && second !== null) return "missing-first";
  if (first !== null && first === second) return "duplicate";
  return null;
}

/** Repair the historical deletion case only when the survivor is valid. */
export function normalizeChartParents<T extends { nodes: ChartNodeRecord[] }>(
  document: T,
): T {
  const ids = new Set(document.nodes.map((node) => node.id));
  let changed = false;
  const nodes = document.nodes.map((node) => {
    const survivor = node.parentNodeId2;
    if (
      parentPairIssue(node.parentNodeId1, survivor) !== "missing-first" ||
      survivor === null ||
      survivor === node.id ||
      !ids.has(survivor)
    )
      return node;
    changed = true;
    return { ...node, parentNodeId1: survivor, parentNodeId2: null };
  });
  return changed ? { ...document, nodes } : document;
}
