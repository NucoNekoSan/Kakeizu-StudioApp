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
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "1800" },
    });
    expect(screen.getByRole("status").textContent).toContain(
      "重なる場合があります",
    );
    fireEvent.click(screen.getByRole("button", { name: "適用" }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(true, 1800));
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });
  it("不正な幅は適用できず、キャンセルで保存しない", () => {
    const apply = setup();
    fireEvent.change(screen.getByRole("spinbutton"), {
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
});
