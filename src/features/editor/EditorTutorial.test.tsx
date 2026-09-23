// @vitest-environment jsdom
import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditorTutorial from "./EditorTutorial";

describe("EditorTutorial", () => {
  afterEach(cleanup);

  it("6ステップを進み、終了できる", () => {
    const onClose = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <div className="editor-shell">
        <button ref={ref}>開始</button>
        <div data-tutorial-target="editor-basics" />
        <EditorTutorial open onClose={onClose} returnFocusRef={ref} />
      </div>,
    );
    expect(screen.getByText("ステップ 1 / 6")).toBeTruthy();
    for (let index = 0; index < 5; index += 1)
      fireEvent.click(screen.getByRole("button", { name: /次へ/ }));
    expect(screen.getByText("ステップ 6 / 6")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "終了する" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Escapeで閉じる", () => {
    const onClose = vi.fn();
    render(
      <div className="editor-shell">
        <EditorTutorial open onClose={onClose} returnFocusRef={createRef()} />
      </div>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
