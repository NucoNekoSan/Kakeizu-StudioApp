// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { exportBlob, withWhiteBackground } from "./exportFormats";

const { addPage, embedJpg } = vi.hoisted(() => ({
  addPage: vi.fn(() => ({ drawImage: vi.fn() })),
  embedJpg: vi.fn(async () => ({})),
}));
vi.mock("pdf-lib", () => ({
  PDFDocument: {
    create: async () => ({
      embedJpg,
      addPage,
      save: async () => new Uint8Array([37, 80, 68, 70]),
    }),
  },
}));

describe("相関図の書き出し形式", () => {
  afterEach(() => vi.restoreAllMocks());

  it("白背景を元画像より先に描く", () => {
    const source = document.createElement("canvas");
    source.width = 2400;
    source.height = 1200;
    const fillRect = vi.fn();
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect,
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const white = withWhiteBackground(source);
    expect([white.width, white.height]).toEqual([2400, 1200]);
    expect(fillRect).toHaveBeenCalledWith(0, 0, 2400, 1200);
    expect(drawImage).toHaveBeenCalledWith(source, 0, 0);
    expect(fillRect.mock.invocationCallOrder[0]).toBeLessThan(
      drawImage.mock.invocationCallOrder[0],
    );
  });

  it("PNG・JPEG・PDFに正しいMIMEタイプを付ける", async () => {
    const source = document.createElement("canvas");
    source.width = 2400;
    source.height = 1200;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockImplementation(
        (mimeType = "image/png") => `data:${mimeType};base64,aW1hZ2U=`,
      );
    expect((await exportBlob(source, "transparent-png")).type).toBe(
      "image/png",
    );
    expect((await exportBlob(source, "white-png")).type).toBe("image/png");
    expect((await exportBlob(source, "jpeg")).type).toBe("image/jpeg");
    expect((await exportBlob(source, "pdf")).type).toBe("application/pdf");
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.92);
    expect(addPage).toHaveBeenCalledWith([842, 421]);
    expect(embedJpg).toHaveBeenCalled();
  });
});
