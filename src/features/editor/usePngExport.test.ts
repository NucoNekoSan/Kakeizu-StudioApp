// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toCanvas } from "html-to-image";
import { drawPngFrame, getPngViewport } from "./pngExport";
import { usePngExport } from "./usePngExport";

vi.mock("html-to-image", () => ({ toCanvas: vi.fn() }));
vi.mock("./pngExport", () => ({
  drawPngFrame: vi.fn(),
  getPngViewport: vi.fn(() => ({ style: { transform: "translated" } })),
  PNG_HEIGHT: 540,
  PNG_WIDTH: 1080,
}));

describe("usePngExport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
    Reflect.deleteProperty(window, "showSaveFilePicker");
  });

  it("renders the viewport and downloads the framed PNG", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T04:05:00.000Z"));
    const root = document.createElement("div"),
      viewport = document.createElement("div"),
      canvas = document.createElement("canvas"),
      context = {} as CanvasRenderingContext2D,
      click = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => undefined);
    viewport.className = "react-flow__viewport";
    root.append(viewport);
    vi.spyOn(canvas, "getContext").mockReturnValue(context);
    vi.spyOn(canvas, "toDataURL").mockReturnValue("data:image/png;base64,png");
    vi.mocked(toCanvas).mockResolvedValue(canvas);
    const { result } = renderHook(() =>
      usePngExport({ current: root }, [], "家族"),
    );

    await act(() => result.current.exportPng());

    expect(getPngViewport).toHaveBeenCalledWith([], 1080, 540);
    expect(toCanvas).toHaveBeenCalledWith(
      viewport,
      expect.objectContaining({
        width: 1080,
        height: 540,
        pixelRatio: 1,
        style: { transform: "translated" },
      }),
    );
    expect(drawPngFrame).toHaveBeenCalledWith(context, 1080, 540);
    expect(click).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({
      exportError: "",
      isExporting: false,
    });
  });

  it("reports the existing error when the viewport is missing", async () => {
    const { result } = renderHook(() =>
      usePngExport({ current: document.createElement("div") }, [], "家族"),
    );

    await act(() => result.current.exportPng());

    expect(toCanvas).not.toHaveBeenCalled();
    expect(result.current.exportError).toBe(
      "PNGの保存に失敗しました。再度お試しください。",
    );
    expect(result.current.isExporting).toBe(false);
  });
  it("previews a custom-width chart without saving", async () => {
    const root = document.createElement("div");
    const viewport = document.createElement("div");
    viewport.className = "react-flow__viewport";
    root.append(viewport);
    const canvas = document.createElement("canvas");
    const context = {} as CanvasRenderingContext2D;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    vi.spyOn(canvas, "getContext").mockReturnValue(context);
    vi.spyOn(canvas, "toDataURL").mockReturnValue("data:image/png;base64,cG5n");
    vi.mocked(toCanvas).mockResolvedValue(canvas);
    const { result } = renderHook(() =>
      usePngExport({ current: root }, [], "家族", 3200, 1800),
    );
    await act(() => result.current.previewPng());
    expect(click).not.toHaveBeenCalled();
    expect(result.current.preview).toMatchObject({
      width: 3200,
      height: 1800,
      dataUrl: "data:image/png;base64,cG5n",
    });
    expect(toCanvas).toHaveBeenCalledWith(
      viewport,
      expect.objectContaining({ width: 3200, height: 1800 }),
    );
    expect(drawPngFrame).toHaveBeenCalledWith(context, 3200, 1800);
    expect(toCanvas).toHaveBeenCalledOnce();
    expect(click).not.toHaveBeenCalled();
    act(() => result.current.closePreview());
    expect(result.current.preview).toBeNull();
  });

  it("白背景PNGでは描画開始より先に保存先を選ぶ", async () => {
    const root = document.createElement("div");
    const viewport = document.createElement("div");
    viewport.className = "react-flow__viewport";
    root.append(viewport);
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 540;
    const write = vi.fn(async () => {});
    const picker = vi.fn(async () => ({
      createWritable: async () => ({ write, close: async () => {} }),
    }));
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: picker,
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,cG5n",
    );
    vi.mocked(toCanvas).mockResolvedValue(canvas);
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      usePngExport({ current: root }, [], "家族", 1080, 540, { onSaved }),
    );
    await act(() => result.current.exportFile("white-png"));
    expect(picker).toHaveBeenCalledOnce();
    expect(picker.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(toCanvas).mock.invocationCallOrder[0],
    );
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image/png" }),
    );
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("JPEGの保存成功を通知し、保存先選択のキャンセルは通知しない", async () => {
    const root = document.createElement("div");
    const viewport = document.createElement("div");
    viewport.className = "react-flow__viewport";
    root.append(viewport);
    const canvas = document.createElement("canvas");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,cG5n",
    );
    vi.mocked(toCanvas).mockResolvedValue(canvas);
    const write = vi.fn(async () => {});
    const picker = vi.fn(async () => ({
      createWritable: async () => ({ write, close: async () => {} }),
    }));
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: picker,
    });
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      usePngExport({ current: root }, [], "家族", 1080, 540, { onSaved }),
    );
    await act(() => result.current.exportFile("jpeg"));
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image/jpeg" }),
    );
    expect(onSaved).toHaveBeenCalledOnce();

    picker.mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
    await act(() => result.current.exportFile("jpeg"));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(toCanvas).toHaveBeenCalledOnce();
  });
});
