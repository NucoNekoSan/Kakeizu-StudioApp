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
  it("uses a fixed 2x viewport centered on the world origin", () => {
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
    expect(viewport.x).toBeCloseTo(PNG_WIDTH / 2);
    expect(viewport.y).toBeCloseTo(PNG_HEIGHT / 2);
    expect(viewport.zoom).toBe(2);
  });

  it("keeps the origin fixed when no self node exists", () => {
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

    expect(viewport.x).toBeCloseTo(PNG_WIDTH / 2);
    expect(viewport.y).toBeCloseTo(PNG_HEIGHT / 2);
  });

  it("maps the exported frame back to fixed origin flow coordinates", () => {
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
    expect(preview!.x + preview!.width / 2).toBeCloseTo(0);
    expect(preview!.y + preview!.height / 2).toBeCloseTo(0);

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
  it("uses a centered custom width for the viewport and frame", () => {
    const nodes = [
      { id: "person", position: { x: 0, y: 0 }, data },
    ] as Node<FamilyNodeData>[];
    const viewport = getPngViewport(nodes, 3200);
    const frame = getPngFramePreview(nodes, 3200)!;
    expect(viewport.x).toBe(1600);
    expect(viewport.style.width).toBe("3200px");
    expect(frame.x + frame.width / 2).toBe(0);
    expect(frame.width * viewport.zoom).toBe(3200 - PNG_FRAME.inset * 2);
  });
});
