import { useCallback, useState, type RefObject } from "react";
import type { Node } from "@xyflow/react";
import type { FamilyNodeData } from "../../familyGraph";
import { prepareFileSave } from "../../storage/fileIo";
import { exportBlob, exportFormats, type ExportFormat } from "./exportFormats";
import {
  drawPngFrame,
  getPngViewport,
  PNG_HEIGHT,
  PNG_WIDTH,
} from "./pngExport";

export interface PngPreview {
  dataUrl: string;
  width: number;
  height: number;
}

export function usePngExport(
  flowRef: RefObject<HTMLDivElement | null>,
  nodes: Node<FamilyNodeData>[],
  title?: string,
  frameWidth = PNG_WIDTH,
  frameHeight = PNG_HEIGHT,
  callbacks: { onPreviewCreated?: () => void; onSaved?: () => void } = {},
) {
  const [isExporting, setIsExporting] = useState(false),
    [exportError, setExportError] = useState(""),
    [preview, setPreview] = useState<PngPreview | null>(null);

  const generatePng = useCallback(
    async (showPreview: boolean, format: ExportFormat = "transparent-png") => {
      if (!flowRef.current) return false;
      const fileType = exportFormats.find((item) => item.value === format)!;
      const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
      const fileName = `${title || "相関図"}-${stamp}${fileType.extension}`;
      // pickerはユーザー操作直後に開かないとブラウザに拒否される。
      const targetPromise = showPreview
        ? null
        : prepareFileSave(fileName, {
            description: fileType.label,
            mimeType: fileType.mimeType,
            extension: fileType.extension,
          });
      setIsExporting(true);
      setExportError("");
      const viewport = flowRef.current.querySelector<HTMLElement>(
        ".react-flow__viewport",
      );
      try {
        const target = showPreview ? null : await targetPromise;
        if (!showPreview && !target) return false;
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
          context = canvas.getContext("2d");
        if (!context) throw new Error("PNG canvas context was not found");
        drawPngFrame(context, frameWidth, frameHeight);
        if (showPreview) {
          const dataUrl = canvas.toDataURL("image/png");
          setPreview({
            dataUrl,
            width: frameWidth,
            height: frameHeight,
          });
          callbacks.onPreviewCreated?.();
          return true;
        } else {
          await target!.save(await exportBlob(canvas, format));
          callbacks.onSaved?.();
          return true;
        }
      } catch {
        setExportError(
          showPreview
            ? "全体プレビューを作成できませんでした。再度お試しください。"
            : `${format === "transparent-png" ? "PNG" : fileType.label}の保存に失敗しました。再度お試しください。`,
        );
        return false;
      } finally {
        setIsExporting(false);
      }
    },
    [callbacks, flowRef, nodes, title, frameWidth, frameHeight],
  );

  const exportPng = useCallback(() => generatePng(false), [generatePng]);
  const exportFile = useCallback(
    (format: ExportFormat) => generatePng(false, format),
    [generatePng],
  );
  const previewPng = useCallback(() => generatePng(true), [generatePng]);
  const closePreview = useCallback(() => {
    setPreview(null);
    setExportError("");
  }, []);
  return {
    exportPng,
    exportFile,
    previewPng,
    preview,
    closePreview,
    exportError,
    isExporting,
  };
}
