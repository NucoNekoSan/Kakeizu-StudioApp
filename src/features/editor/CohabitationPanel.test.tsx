// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import type { FamilyNodeData } from "../../familyGraph";
import { CohabitationPanel } from "./CohabitationPanel";

const node = (id: string, name: string) =>
  ({
    id,
    position: { x: 0, y: 0 },
    data: { relationshipName: name, memo: "" },
  }) as Node<FamilyNodeData>;

describe("CohabitationPanel", () => {
  afterEach(cleanup);
  it("offers a keyboard-operable alternative for group creation", () => {
    const onCreateGroup = vi.fn();
    render(
      <CohabitationPanel
        nodes={[node("a", "本人"), node("b", "配偶者")]}
        groups={[]}
        labels={[]}
        selectedGroupId={null}
        selectedLabelId={null}
        onSelectGroup={vi.fn()}
        onSelectLabel={vi.fn()}
        onCreateGroup={onCreateGroup}
        onUpdateGroup={vi.fn()}
        onUpdateLabel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const create = screen.getByRole("button", {
      name: /同居輪で囲む/,
    }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "本人" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "配偶者" }));
    expect(create.disabled).toBe(false);
    fireEvent.click(create);
    expect(onCreateGroup).toHaveBeenCalledWith(["a", "b"]);
  });

  it("uses Shift+Arrow for ten-point font size adjustments", () => {
    const onUpdateLabel = vi.fn();
    render(
      <CohabitationPanel
        nodes={[]}
        groups={[]}
        labels={[{ id: "label", x: 10, y: 20, fontSize: 18 }]}
        selectedGroupId={null}
        selectedLabelId="label"
        onSelectGroup={vi.fn()}
        onSelectLabel={vi.fn()}
        onCreateGroup={vi.fn()}
        onUpdateGroup={vi.fn()}
        onUpdateLabel={onUpdateLabel}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "文字サイズ" }), {
      key: "ArrowUp",
      shiftKey: true,
    });
    expect(onUpdateLabel).toHaveBeenCalledWith("label", { fontSize: 28 });
  });
});
