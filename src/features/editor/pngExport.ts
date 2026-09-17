import { type Node } from "@xyflow/react";
import type { FamilyNodeData } from "../../familyGraph";

export const PNG_WIDTH = 2400;
export const PNG_HEIGHT = 1200;
export const PNG_EXPORT_SCALE = 2;
export const PNG_FRAME = {
  color: "#52645e",
  inset: 24,
  lineWidth: 6,
  dash: [24, 16] as const,
  radius: 28,
};

export interface PngFramePreview {
  x: number;
  y: number;
  width: number;
  height: number;
  strokeWidth: number;
  dash: readonly [number, number];
  radius: number;
}

export function getPngViewport(
  nodes: Node<FamilyNodeData>[],
  width = PNG_WIDTH,
) {
  if (!nodes.length) {
    return {
      x: 0,
      y: 0,
      zoom: 1,
      style: {
        width: `${width}px`,
        height: `${PNG_HEIGHT}px`,
        transform: "translate(0px, 0px) scale(1)",
      },
    };
  }

  const viewport = {
      x: width / 2,
      y: PNG_HEIGHT / 2,
      zoom: PNG_EXPORT_SCALE,
    },
    zoom = viewport.zoom,
    x = viewport.x,
    y = viewport.y;

  return {
    x,
    y,
    zoom,
    style: {
      width: `${width}px`,
      height: `${PNG_HEIGHT}px`,
      transform: `translate(${x}px, ${y}px) scale(${zoom})`,
    },
  };
}

export function getPngFramePreview(
  nodes: Node<FamilyNodeData>[],
  width = PNG_WIDTH,
): PngFramePreview | null {
  if (!nodes.length) return null;

  const { x, y, zoom } = getPngViewport(nodes, width),
    { dash, inset, lineWidth, radius } = PNG_FRAME;

  return {
    x: (inset - x) / zoom,
    y: (inset - y) / zoom,
    width: (width - inset * 2) / zoom,
    height: (PNG_HEIGHT - inset * 2) / zoom,
    strokeWidth: lineWidth / zoom,
    dash: [dash[0] / zoom, dash[1] / zoom],
    radius: radius / zoom,
  };
}

export function drawPngFrame(
  context: CanvasRenderingContext2D,
  width = PNG_WIDTH,
) {
  const { color, dash, inset, lineWidth, radius } = PNG_FRAME,
    left = inset,
    top = inset,
    right = width - inset,
    bottom = PNG_HEIGHT - inset;

  context.save();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.setLineDash([...dash]);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(left + radius, top);
  context.lineTo(right - radius, top);
  context.quadraticCurveTo(right, top, right, top + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(left + radius, bottom);
  context.quadraticCurveTo(left, bottom, left, bottom - radius);
  context.lineTo(left, top + radius);
  context.quadraticCurveTo(left, top, left + radius, top);
  context.closePath();
  context.stroke();
  context.restore();
}
