import { describe, expect, it } from "vitest";
import {
  createCohabitationFromNodes,
  emptyCohabitationDocument,
  findNodeIdsInsidePolygon,
  isCohabitationDocument,
} from "./cohabitationModel";
import type { Node } from "@xyflow/react";
import type { FamilyNodeData } from "../../familyGraph";

const graphNode = (id: string, x: number, y: number) =>
  ({
    id,
    position: { x, y },
    width: 100,
    height: 100,
    data: { scale: 1 },
  }) as Node<FamilyNodeData>;

describe("cohabitation document model", () => {
  it("creates and validates a v1 empty document", () => {
    const document = emptyCohabitationDocument();
    expect(document).toEqual({ version: 1, cohabitations: [], labels: [] });
    expect(isCohabitationDocument(document)).toBe(true);
  });

  it("rejects unknown versions and malformed numeric fields", () => {
    expect(
      isCohabitationDocument({ version: 2, cohabitations: [], labels: [] }),
    ).toBe(false);
    expect(
      isCohabitationDocument({
        version: 1,
        cohabitations: [],
        labels: [{ id: "label", x: NaN, y: 2, fontSize: 20 }],
      }),
    ).toBe(false);
  });

  it("finds node centers inside a polygon and creates bounded groups", () => {
    const nodes = [graphNode("inside", 0, 0), graphNode("outside", 300, 300)];
    const ids = findNodeIdsInsidePolygon(
      [
        { x: -10, y: -10 },
        { x: 150, y: -10 },
        { x: 150, y: 150 },
        { x: -10, y: 150 },
      ],
      nodes,
    );
    expect(ids).toEqual(["inside"]);
    const group = createCohabitationFromNodes(nodes, ["inside", "outside"]);
    expect(group?.nodeIds).toEqual(["inside", "outside"]);
    expect(group?.rx).toBeGreaterThanOrEqual(30);
    expect(group?.ry).toBeGreaterThanOrEqual(30);
  });

  it("creates and validates a group containing one existing node", () => {
    const group = createCohabitationFromNodes(
      [graphNode("one", 0, 0)],
      ["one"],
    );
    if (!group) throw new Error("単独ノードの同居輪を作成できません");
    expect(group?.nodeIds).toEqual(["one"]);
    expect(group?.rx).toBeGreaterThanOrEqual(30);
    expect(group?.ry).toBeGreaterThanOrEqual(30);
    expect(
      isCohabitationDocument({
        version: 1,
        cohabitations: [group],
        labels: [],
      }),
    ).toBe(true);
    expect(createCohabitationFromNodes([], [])).toBeNull();
  });
});
