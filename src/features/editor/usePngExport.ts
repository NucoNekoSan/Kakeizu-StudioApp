import { useCallback, useState, type RefObject } from "react";
import type { Node } from "@xyflow/react";
import type { FamilyNodeData } from "../../familyGraph";
import { dataUrlToBlob, saveFile } from "../../storage/fileIo";
import {
  drawPngFrame,
  getPngViewport,
  PNG_HEIGHT,
  PNG_WIDTH,
} from "./pngExport";

export function usePngExport(
  flowRef: RefObject<HTMLDivElement | null>,
  nodes: Node<FamilyNodeData>[],
  title?: string,
) {
  const [isExporting, setIsExporting] = useState(false),
    [exportError, setExportError] = useState("");

  const exportPng = useCallback(async () => {
    if (!flowRef.current) return;
    setIsExporting(true);
    setExportError("");
    const viewport = flowRef.current.querySelector<HTMLElement>(
      ".react-flow__viewport",
    );
    try {
      if (!viewport) throw new Error("React Flow viewport was not found");
      const { toCanvas } = await import("html-to-image"),
        exportViewport = getPngViewport(nodes),
        canvas = await toCanvas(viewport, {
          width: PNG_WIDTH,
          height: PNG_HEIGHT,
          pixelRatio: 1,
          style: exportViewport.style,
          filter: (node) =>
            !(node instanceof Element) ||
            (!node.closest(".png-frame-preview") &&
              !node.classList.contains("react-flow__controls") &&
              !node.classList.contains("react-flow__minimap") &&
              !node.classList.contains("react-flow__background")),
        }),
        context = canvas.getContext("2d"),
        stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
      if (!context) throw new Error("PNG canvas context was not found");
      drawPngFrame(context);
      await saveFile(
        `${title || "相関図"}-${stamp}.png`,
        dataUrlToBlob(canvas.toDataURL("image/png")),
        {
          description: "PNG画像",
          mimeType: "image/png",
          extension: ".png",
        },
      );
    } catch {
      setExportError("PNGの保存に失敗しました。再度お試しください。");
    } finally {
      setIsExporting(false);
    }
  }, [flowRef, nodes, title]);

  return { exportPng, exportError, isExporting };
}
