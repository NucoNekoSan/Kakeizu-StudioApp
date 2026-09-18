// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FrameSettings } from "./FrameSettings";
import "@testing-library/jest-dom/vitest";
import { readFrameVisibility, writeFrameVisibility } from "./frameVisibility";
import { writeStorageMode } from "../../storage/storageMode";

describe("外枠設定", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    writeStorageMode("persistent");
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });
  afterEach(cleanup);
  const setup = (onApply = vi.fn().mockResolvedValue(undefined)) => {
    render(
      <FrameSettings
        visible={false}
        width={2400}
        height={1200}
        isSaving={false}
        error=""
        willMove={() => true}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "外枠" }));
    // jsdomではshowModalによりopenが付かないため、ブラウザの動作を補う。
    document.querySelector("dialog")!.setAttribute("open", "");
    return onApply;
  };
  it("初期非表示で、端末の表示設定を記憶する", () => {
    expect(readFrameVisibility()).toBe(false);
    writeFrameVisibility(true);
    expect(readFrameVisibility()).toBe(true);
    writeStorageMode("session");
    localStorage.clear();
    writeFrameVisibility(false);
    expect(readFrameVisibility()).toBe(false);
    expect(localStorage.getItem("kakeizu:frame-visible")).toBeNull();
  });
  it("幅の変更と移動の案内を表示して適用する", async () => {
    const apply = setup();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("PNGの横幅（px）"), {
      target: { value: "1800" },
    });
    expect(screen.getByRole("status").textContent).toContain(
      "重なる場合があります",
    );
    fireEvent.click(screen.getByRole("button", { name: "適用" }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(true, 1800, 1200));
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });
  it("不正な幅は適用できず、キャンセルで保存しない", () => {
    const apply = setup();
    fireEvent.change(screen.getByLabelText("PNGの横幅（px）"), {
      target: { value: "1100" },
    });
    expect(
      (screen.getByRole("button", { name: "適用" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(apply).not.toHaveBeenCalled();
  });
  it("保存に失敗したときは閉じない", async () => {
    const apply = setup(vi.fn().mockRejectedValue(new Error("保存失敗")));
    fireEvent.click(screen.getByRole("button", { name: "適用" }));
    await waitFor(() => expect(apply).toHaveBeenCalled());
    expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled();
  });
  it.each([600, 1200, 4800])(
    "縦幅%dpxを横幅と独立して適用する",
    async (height) => {
      const apply = setup();
      fireEvent.change(screen.getByLabelText("PNGの縦幅（px）"), {
        target: { value: String(height) },
      });
      fireEvent.click(screen.getByRole("button", { name: "適用" }));
      await waitFor(() =>
        expect(apply).toHaveBeenCalledWith(false, 2400, height),
      );
    },
  );
  it.each(["", "599", "4801", "1200.5"])(
    "不正な縦幅%sは適用できない",
    (height) => {
      setup();
      fireEvent.change(screen.getByLabelText("PNGの縦幅（px）"), {
        target: { value: height },
      });
      expect(screen.getByRole("alert").textContent).toContain("縦幅");
      expect(screen.getByRole("button", { name: "適用" })).toBeDisabled();
    },
  );
  it("縦幅ボタンは100px刻みで境界を超えない", () => {
    setup();
    const input = screen.getByLabelText("PNGの縦幅（px）") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "縦幅を100px増やす" }));
    expect(input.value).toBe("1300");
    fireEvent.change(input, { target: { value: "650" } });
    fireEvent.click(screen.getByRole("button", { name: "縦幅を100px減らす" }));
    expect(input.value).toBe("600");
    expect(
      screen.getByRole("button", { name: "縦幅を100px減らす" }),
    ).toBeDisabled();
    fireEvent.change(input, { target: { value: "4750" } });
    fireEvent.click(screen.getByRole("button", { name: "縦幅を100px増やす" }));
    expect(input.value).toBe("4800");
    expect(
      screen.getByRole("button", { name: "縦幅を100px増やす" }),
    ).toBeDisabled();
  });
  it("縦横を変更後キャンセルして開き直すと保存値に戻る", () => {
    const apply = setup();
    fireEvent.change(screen.getByLabelText("PNGの横幅（px）"), {
      target: { value: "1800" },
    });
    fireEvent.change(screen.getByLabelText("PNGの縦幅（px）"), {
      target: { value: "600" },
    });
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    fireEvent.click(screen.getByRole("button", { name: "外枠" }));
    expect(
      (screen.getByLabelText("PNGの横幅（px）") as HTMLInputElement).value,
    ).toBe("2400");
    expect(
      (screen.getByLabelText("PNGの縦幅（px）") as HTMLInputElement).value,
    ).toBe("1200");
    expect(apply).not.toHaveBeenCalled();
  });
});
