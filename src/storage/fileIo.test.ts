// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareFileSave } from "./fileIo";

const options = {
  description: "JPEG画像",
  mimeType: "image/jpeg",
  extension: ".jpg",
};

describe("ファイルの保存先選択", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "showSaveFilePicker");
  });

  it("保存操作と同時にピッカーを開き、選んだ場所へ書き込む", async () => {
    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const showSaveFilePicker = vi.fn(async () => ({
      createWritable: async () => ({ write, close }),
    }));
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: showSaveFilePicker,
    });
    const targetPromise = prepareFileSave("相関図.jpg", options);
    expect(showSaveFilePicker).toHaveBeenCalledOnce();
    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: "相関図.jpg",
      types: [{ description: "JPEG画像", accept: { "image/jpeg": [".jpg"] } }],
    });
    const target = await targetPromise;
    const blob = new Blob(["image"], { type: "image/jpeg" });
    await target?.save(blob);
    expect(write).toHaveBeenCalledWith(blob);
    expect(close).toHaveBeenCalledOnce();
  });

  it("保存先選択を取り消したときはファイルを作らない", async () => {
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: vi.fn(async () => {
        throw new DOMException("cancel", "AbortError");
      }),
    });
    expect(await prepareFileSave("相関図.jpg", options)).toBeNull();
  });

  it("選択後の書き込み失敗を通常ダウンロードで隠さない", async () => {
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: vi.fn(async () => ({
        createWritable: async () => ({
          write: async () => {
            throw new Error("disk full");
          },
          close: async () => {},
        }),
      })),
    });
    const target = await prepareFileSave("相関図.jpg", options);
    await expect(target?.save(new Blob(["image"]))).rejects.toThrow(
      "disk full",
    );
  });

  it("非対応ブラウザでは通常ダウンロードに切り替える", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const target = await prepareFileSave("相関図.jpg", options);
    await target?.save(new Blob(["image"], { type: "image/jpeg" }));
    expect(click).toHaveBeenCalledOnce();
  });
});
