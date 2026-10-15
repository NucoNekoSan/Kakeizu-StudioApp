import { describe, expect, it } from "vitest";
import type { ChartDetail } from "../../types";
import { hydrateChart } from "./hydrateChart";

const chart: ChartDetail = {
  cohabitation: { version: 1, cohabitations: [], labels: [] },
  id: "chart",
  title: "テスト",
  updatedAt: "2026-09-08T00:00:00Z",
  relationships: [
    {
      id: "self-rel",
      name: "本人",
      kind: "self",
      direction: "below",
      lineStyle: "solid",
      lineColor: "#52645e",
      sortOrder: 0,
      active: true,
    },
    {
      id: "partner-rel",
      name: "配偶者",
      kind: "partner",
      direction: "right",
      lineStyle: "solid",
      lineColor: "#9b7440",
      sortOrder: 1,
      active: true,
    },
  ],
  genders: [
    {
      id: "gender",
      name: "女性",
      shape: "circle",
      fillColor: "#d8785b",
      textColor: "#ffffff",
      sortOrder: 0,
      active: true,
    },
  ],
  nodes: [
    {
      id: "self",
      relationshipId: "self-rel",
      genderId: "gender",
      anchorNodeId: null,
      parentNodeId1: null,
      parentNodeId2: null,
      placementDirection: null,
      connectionDirection: null,
      divorced: false,
      memo: "",
      fontSize: 16,
      relationshipFontSize: 17,
      scale: 1,
      x: 0,
      y: 0,
    },
    {
      id: "partner",
      relationshipId: "partner-rel",
      genderId: "gender",
      anchorNodeId: "self",
      parentNodeId1: null,
      parentNodeId2: null,
      placementDirection: "right",
      connectionDirection: null,
      divorced: true,
      memo: "",
      fontSize: 16,
      relationshipFontSize: 17,
      scale: 1.5,
      x: 220,
      y: 0,
    },
  ],
  edges: [
    {
      id: "edge",
      source: "self",
      target: "partner",
      relationshipId: "partner-rel",
      relationKind: "partner",
      lineStyle: "solid",
      lineColor: "#9b7440",
    },
  ],
};

describe("hydrateChart", () => {
  it("maps node definitions and converts a divorced partner edge", () => {
    const result = hydrateChart(chart);
    expect(result.nodes[1]).toMatchObject({
      position: { x: 220, y: 0 },
      width: 270,
      data: {
        relationshipName: "配偶者",
        genderName: "女性",
        divorced: true,
        scale: 1.5,
      },
    });
    expect(result.nodes[1].height).toBeUndefined();
    expect(result.edges[0]).toMatchObject({
      data: { relationKind: "divorce" },
      markerEnd: undefined,
    });
  });

  it("keeps divorce state scoped to its own partner relationship", () => {
    const detail: ChartDetail = {
      ...chart,
      nodes: [
        { ...chart.nodes[0], divorced: true },
        chart.nodes[1],
        {
          ...chart.nodes[1],
          id: "current-partner",
          anchorNodeId: "self",
          divorced: false,
          x: -220,
        },
      ],
      edges: [
        chart.edges[0],
        {
          ...chart.edges[0],
          id: "current-edge",
          target: "current-partner",
        },
      ],
    };
    const result = hydrateChart(detail);
    expect(result.edges[0].data).toMatchObject({ relationKind: "divorce" });
    expect(result.edges[1].data).toMatchObject({ relationKind: "partner" });
  });
});
