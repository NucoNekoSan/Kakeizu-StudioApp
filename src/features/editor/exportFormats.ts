import { dataUrlToBlob } from "../../storage/fileIo";

export type ExportFormat = "transparent-png" | "white-png" | "jpeg" | "pdf";

export const exportFormats: ReadonlyArray<{
  value: ExportFormat;
  label: string;
  extension: string;
  mimeType: string;
}> = [
  {
    value: "transparent-png",
    label: "透過PNG",
    extension: ".png",
    mimeType: "image/png",
  },
  {
    value: "white-png",
    label: "白背景PNG",
    extension: ".png",
    mimeType: "image/png",
  },
  { value: "jpeg", label: "JPEG", extension: ".jpg", mimeType: "image/jpeg" },
  {
    value: "pdf",
    label: "PDF（1ページ）",
    extension: ".pdf",
    mimeType: "application/pdf",
  },
];

/** 白背景の形式は元の透過Canvasを変更せずに合成する。 */
export function withWhiteBackground(
  source: HTMLCanvasElement,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image canvas context was not found");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0);
  return canvas;
}

export async function exportBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
): Promise<Blob> {
  if (format === "transparent-png")
    return dataUrlToBlob(canvas.toDataURL("image/png"));
  const white = withWhiteBackground(canvas);
  if (format === "white-png")
    return dataUrlToBlob(white.toDataURL("image/png"));
  const jpeg = white.toDataURL("image/jpeg", 0.92);
  if (format === "jpeg") return dataUrlToBlob(jpeg);

  const { PDFDocument } = await import("pdf-lib");
  const document = await PDFDocument.create();
  const image = await document.embedJpg(jpeg);
  const scale = 842 / Math.max(canvas.width, canvas.height);
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  document.addPage([width, height]).drawImage(image, {
    x: 0,
    y: 0,
    width,
    height,
  });
  const bytes = await document.save();
  return new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
}
