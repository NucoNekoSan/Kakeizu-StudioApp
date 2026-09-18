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

export interface PngPreview {
  dataUrl: string;
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
}

const pngFileType = {
  description: "PNG画像",
  mimeType: "image/png",
  extension: ".png",
};

export function usePngExport(
  flowRef: RefObject<HTMLDivElement | null>,
  nodes: Node<FamilyNodeData>[],
  title?: string,
  frameWidth = PNG_WIDTH,
  frameHeight = PNG_HEIGHT,
) {
  const [isExporting, setIsExporting] = useState(false),
    [exportError, setExportError] = useState(""),
    [preview, setPreview] = useState<PngPreview | null>(null);

  const generatePng = useCallback(
    async (showPreview: boolean) => {
      if (!flowRef.current) return;
      setIsExporting(true);
      setExportError("");
      const viewport = flowRef.current.querySelector<HTMLElement>(
        ".react-flow__viewport",
      );
      try {
        if (!viewport) throw new Error("React Flow viewport was not found");
        const { toCanvas } = await import("html-to-image"),
          exportViewport = getPngViewport(nodes, frameWidth, frameHeight),
          canvas = await toCanvas(viewport, {
            width: frameWidth,
            height: frameHeight,
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
        drawPngFrame(context, frameWidth, frameHeight);
        const dataUrl = canvas.toDataURL("image/png");
        const image = {
          dataUrl,
          blob: dataUrlToBlob(dataUrl),
          fileName: `${title || "相関図"}-${stamp}.png`,
          width: frameWidth,
          height: frameHeight,
        };
        if (showPreview) setPreview(image);
        else await saveFile(image.fileName, image.blob, pngFileType);
      } catch {
        setExportError(
          showPreview
            ? "PNGのプレビューを作成できませんでした。再度お試しください。"
            : "PNGの保存に失敗しました。再度お試しください。",
        );
      } finally {
        setIsExporting(false);
      }
    },
    [flowRef, nodes, title, frameWidth, frameHeight],
  );

  const exportPng = useCallback(() => generatePng(false), [generatePng]);
  const previewPng = useCallback(() => generatePng(true), [generatePng]);
  const closePreview = useCallback(() => {
    setPreview(null);
    setExportError("");
  }, []);
  const savePreview = useCallback(async () => {
    if (!preview) return;
    setIsExporting(true);
    setExportError("");
    try {
      await saveFile(preview.fileName, preview.blob, pngFileType);
    } catch {
      setExportError("PNGの保存に失敗しました。再度お試しください。");
    } finally {
      setIsExporting(false);
    }
  }, [preview]);
  return {
    exportPng,
    previewPng,
    preview,
    closePreview,
    savePreview,
    exportError,
    isExporting,
  };
}
