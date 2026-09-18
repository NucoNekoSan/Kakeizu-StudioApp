import { describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import type { FamilyNodeData } from "../../familyGraph";
import {
  drawPngFrame,
  getPngFramePreview,
  getPngViewport,
  PNG_FRAME,
  PNG_HEIGHT,
  PNG_WIDTH,
} from "./pngExport";
import { clampNodeToFrame, nodeSize } from "./nodeLayout";

const data: FamilyNodeData = {
  relationshipId: "self",
  relationshipName: "本人",
  relationKind: "self",
  lineStyle: "solid",
  lineColor: "#52645e",
  genderId: "gender",
  genderName: "未設定",
  shape: "circle",
  fillColor: "#fff",
  textColor: "#000",
  memo: "",
  fontSize: 16,
  relationshipFontSize: 17,
  scale: 1,
  anchorNodeId: null,
  parentNodeId1: null,
  parentNodeId2: null,
  placementDirection: null,
  connectionDirection: null,
  divorced: false,
};

describe("PNG export viewport", () => {
  it("uses a fixed 2x viewport centered on the first self card", () => {
    const nodes: Node<FamilyNodeData>[] = [
        {
          id: "self",
          position: { x: 0, y: 0 },
          measured: { width: 180, height: 120 },
          data,
        },
        {
          id: "right",
          position: { x: 1000, y: 500 },
          measured: { width: 180, height: 120 },
          data,
        },
      ],
      viewport = getPngViewport(nodes);
    expect(PNG_WIDTH / PNG_HEIGHT).toBe(2);
    expect(viewport.style).toMatchObject({
      width: "2400px",
      height: "1200px",
    });
    expect(viewport.x + 90 * viewport.zoom).toBeCloseTo(PNG_WIDTH / 2);
    expect(viewport.y + 60 * viewport.zoom).toBeCloseTo(PNG_HEIGHT / 2);
    expect(viewport.zoom).toBe(2);
  });

  it("keeps the initial card center fixed when no self node exists", () => {
    const otherData = { ...data, relationKind: "other" as const },
      nodes: Node<FamilyNodeData>[] = [
        {
          id: "left",
          position: { x: 100, y: 200 },
          measured: { width: 180, height: 120 },
          data: otherData,
        },
        {
          id: "right",
          position: { x: 500, y: 400 },
          measured: { width: 180, height: 120 },
          data: otherData,
        },
      ],
      viewport = getPngViewport(nodes);

    expect(viewport.x + 90 * viewport.zoom).toBeCloseTo(PNG_WIDTH / 2);
    expect(viewport.y + 60 * viewport.zoom).toBeCloseTo(PNG_HEIGHT / 2);
  });

  it("maps the exported frame back to the initial card center", () => {
    const self: Node<FamilyNodeData> = {
        id: "self",
        position: { x: 100, y: 200 },
        measured: { width: 180, height: 120 },
        data,
      },
      other: Node<FamilyNodeData> = {
        ...self,
        id: "other",
        position: { x: 900, y: 500 },
        data: { ...data, relationKind: "other" },
      },
      preview = getPngFramePreview([self, other]);

    expect(preview).not.toBeNull();
    expect(preview!.x + preview!.width / 2).toBeCloseTo(90);
    expect(preview!.y + preview!.height / 2).toBeCloseTo(60);

    const viewport = getPngViewport([self, other]);
    expect(preview!.x * viewport.zoom + viewport.x).toBeCloseTo(
      PNG_FRAME.inset,
    );
    expect(preview!.width * viewport.zoom).toBeCloseTo(
      PNG_WIDTH - PNG_FRAME.inset * 2,
    );
    expect(preview!.strokeWidth * viewport.zoom).toBeCloseTo(
      PNG_FRAME.lineWidth,
    );
  });

  it("previews a fixed frame without a self node", () => {
    const node: Node<FamilyNodeData> = {
      id: "other",
      position: { x: 100, y: 200 },
      measured: { width: 180, height: 120 },
      data: { ...data, relationKind: "other" },
    };

    expect(getPngFramePreview([node])).not.toBeNull();
    expect(getPngFramePreview([])).toBeNull();
  });

  it("draws one rounded green dashed frame without filling the canvas", () => {
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      strokeStyle: "",
      lineWidth: 0,
      lineCap: "butt",
      lineJoin: "miter",
    };

    drawPngFrame(context as unknown as CanvasRenderingContext2D);

    expect(context.strokeStyle).toBe("#52645e");
    expect(context.lineWidth).toBe(6);
    expect(context.setLineDash).toHaveBeenCalledWith([24, 16]);
    expect(context.moveTo).toHaveBeenCalledWith(52, 24);
    expect(context.quadraticCurveTo).toHaveBeenCalledTimes(4);
    expect(context.stroke).toHaveBeenCalledOnce();
    expect(context.fill).not.toHaveBeenCalled();
  });
});

describe("custom frame width", () => {
  it.each([600, 1200, 4800])(
    "uses height %d with the fixed center and matching export bounds",
    (height) => {
      const nodes = [{ id: "self", position: { x: 0, y: 0 }, data }];
      const viewport = getPngViewport(nodes, 2400, height);
      const frame = getPngFramePreview(nodes, 2400, height)!;
      expect(viewport.style.height).toBe(`${height}px`);
      expect(frame.x + frame.width / 2).toBe(90);
      expect(frame.y + frame.height / 2).toBe(60);
      expect(frame.y * viewport.zoom + viewport.y).toBe(PNG_FRAME.inset);
      expect(frame.height * viewport.zoom).toBe(height - 2 * PNG_FRAME.inset);
      expect(
        clampNodeToFrame({ x: 0, y: -10000 }, nodeSize(nodes[0]), frame).y,
      ).toBe(frame.y);
      expect(
        clampNodeToFrame({ x: 0, y: 10000 }, nodeSize(nodes[0]), frame).y,
      ).toBe(frame.y + frame.height - 120);
      expect(getPngViewport([], 2400, height).style.height).toBe(`${height}px`);
    },
  );
  it("draws the frame inside the custom canvas height", () => {
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
    };
    drawPngFrame(context as unknown as CanvasRenderingContext2D, 1800, 600);
    expect(context.lineTo).toHaveBeenCalledWith(1776, 548);
    expect(context.quadraticCurveTo).toHaveBeenCalledWith(1776, 576, 1748, 576);
  });
  it("uses a centered custom width for the viewport and frame", () => {
    const nodes = [
      { id: "person", position: { x: 0, y: 0 }, data },
    ] as Node<FamilyNodeData>[];
    const viewport = getPngViewport(nodes, 3200);
    const frame = getPngFramePreview(nodes, 3200)!;
    expect(viewport.x).toBe(1420);
    expect(viewport.style.width).toBe("3200px");
    expect(frame.x + frame.width / 2).toBe(90);
    expect(frame.width * viewport.zoom).toBe(3200 - PNG_FRAME.inset * 2);
  });
});

describe("fixed initial frame", () => {
  it.each([
    { data: { ...data, scale: 2 }, expected: { x: 90, y: 60 } },
    { data, width: 240, height: 160, expected: { x: 90, y: 60 } },
    {
      data,
      measured: { width: 200, height: 150 },
      expected: { x: 90, y: 60 },
    },
  ])(
    "ignores subsequent card dimensions and scale: %j",
    ({ expected, ...props }) => {
      const self: Node<FamilyNodeData> = {
        id: "self",
        position: { x: 460, y: 180 },
        ...props,
      };
      const frame = getPngFramePreview([self])!;
      expect(frame.x + frame.width / 2).toBe(expected.x);
      expect(frame.y + frame.height / 2).toBe(expected.y);
    },
  );

  it("keeps the frame fixed after movement and self deletion without changing positions", () => {
    const self = { id: "self", position: { x: 0, y: 0 }, data };
    const other = {
      id: "other",
      position: { x: 0, y: 0 },
      data: { ...data, relationKind: "other" as const },
    };
    const frame = getPngFramePreview([self, other])!;
    expect(
      getPngFramePreview([self, { ...other, position: { x: 900, y: 600 } }]),
    ).toEqual(frame);
    const moved = getPngFramePreview([
      { ...self, position: { x: 510, y: 250 } },
      other,
    ])!;
    expect(moved).toEqual(frame);
    expect(
      getPngViewport([{ ...self, position: { x: 510, y: 250 } }, other]),
    ).toEqual(getPngViewport([self, other]));
    expect(
      getPngFramePreview(JSON.parse(JSON.stringify([self, other]))),
    ).toEqual(frame);
    expect(getPngFramePreview([other])).toEqual(frame);
    for (const width of [1200, 2400, 4800]) {
      const resized = getPngFramePreview([self, other], width)!;
      expect(resized.x + resized.width / 2).toBe(90);
      expect(resized.y + resized.height / 2).toBe(60);
      expect(clampNodeToFrame(self.position, nodeSize(self), resized)).toEqual(
        self.position,
      );
    }
    expect(self.position).toEqual({ x: 0, y: 0 });
  });
});
