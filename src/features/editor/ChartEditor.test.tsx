// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import type { ChartDetail, ChartNodeRecord } from "../../types";
import type { FamilyNodeData } from "../../familyGraph";
import { NodeForm } from "./NodeForm";

afterEach(cleanup);

const relationship = (
  id: string,
  name: string,
  kind: "child" | "partner" | "sibling",
) => ({
  id,
  name,
  kind,
  direction: "right" as const,
  lineStyle: "solid" as const,
  lineColor: "#52645e",
  sortOrder: 0,
  active: true,
});

const node = (
  id: string,
  name: string,
  anchorNodeId: string | null,
  relationKind: FamilyNodeData["relationKind"],
  overrides: Partial<FamilyNodeData> = {},
): Node<FamilyNodeData> => ({
  id,
  type: "family",
  position: { x: id === "person" ? 100 : 320, y: 100 },
  data: {
    relationshipId: `${relationKind}-relationship`,
    relationshipName: name,
    relationKind,
    lineStyle: "solid",
    lineColor: "#52645e",
    genderId: "gender",
    genderName: "未設定",
    shape: "circle",
    fillColor: "#fff",
    textColor: "#000",
    memo: "",
    fontSize: 16,
    relationshipFontSize: 17,
    scale: 1,
    anchorNodeId,
    parentNodeId1: null,
    parentNodeId2: null,
    placementDirection: null,
    connectionDirection: null,
    divorced: false,
    ...overrides,
  },
});

const detail = (nodes: ChartNodeRecord[] = []): ChartDetail => ({
  id: "chart",
  title: "家族",
  updatedAt: "2026-09-09T00:00:00Z",
  relationships: [
    relationship("child-relationship", "子", "child"),
    relationship("partner-relationship", "配偶者", "partner"),
    relationship("sibling-relationship", "兄弟姉妹", "sibling"),
  ],
  genders: [
    {
      id: "gender",
      name: "未設定",
      shape: "circle",
      fillColor: "#fff",
      textColor: "#000",
      sortOrder: 0,
      active: true,
    },
  ],
  nodes,
  edges: [],
});

const record = (
  id: string,
  parentNodeId1: string | null,
  parentNodeId2: string | null,
): ChartNodeRecord => ({
  id,
  relationshipId: "child-relationship",
  genderId: "gender",
  anchorNodeId: parentNodeId1,
  parentNodeId1,
  parentNodeId2,
  placementDirection: "below",
  connectionDirection: null,
  divorced: false,
  memo: "",
  fontSize: 16,
  relationshipFontSize: 17,
  scale: 1,
  x: 320,
  y: 320,
});

describe("initial self placement", () => {
  it.each(["above", "below", "left", "right"])(
    "places the first self at the origin for direction %s",
    (direction) => {
      const chart = detail();
      chart.relationships.unshift({
        ...relationship("self-relationship", "本人", "child"),
        kind: "self",
      });
      const onSubmit = vi.fn();
      render(
        <NodeForm mode="add" detail={chart} nodes={[]} onSubmit={onSubmit} />,
      );
      fireEvent.change(screen.getByLabelText("配置方向"), {
        target: { value: direction },
      });
      fireEvent.click(screen.getByRole("button", { name: "自動配置して追加" }));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ x: 0, y: 0, anchorNodeId: null }),
      );
    },
  );

  it("places self at the origin even when an anchor already exists", () => {
    const chart = detail();
    chart.relationships.unshift({
      ...relationship("self-relationship", "本人", "child"),
      kind: "self",
    });
    const onSubmit = vi.fn();
    render(
      <NodeForm
        mode="add"
        detail={chart}
        nodes={[node("person", "本人", null, "self")]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "自動配置して追加" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, anchorNodeId: "person" }),
    );
  });
});
describe("relationship quick add form", () => {
  it("automatically selects the only partner as the child's second parent", () => {
    const nodes = [
        node("person", "本人", null, "self"),
        node("partner", "配偶者", "person", "partner"),
      ],
      onSubmit = vi.fn();
    render(
      <NodeForm
        mode="add"
        detail={detail()}
        nodes={nodes}
        preset={{ kind: "child", anchorId: "person" }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("基準人物：").textContent).toContain("本人");
    expect((screen.getByLabelText("配偶者") as HTMLSelectElement).value).toBe(
      "partner",
    );
    fireEvent.click(screen.getByRole("button", { name: "自動配置して追加" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        relationshipId: "child-relationship",
        anchorNodeId: "person",
        parentNodeId1: "person",
        parentNodeId2: "partner",
        placementDirection: "below",
      }),
    );
  });

  it("keeps a new child single-parent when no partner exists", () => {
    const onSubmit = vi.fn();
    render(
      <NodeForm
        mode="add"
        detail={detail()}
        nodes={[node("person", "本人", null, "self")]}
        preset={{ kind: "child", anchorId: "person" }}
        onSubmit={onSubmit}
      />,
    );

    expect((screen.getByLabelText("配偶者") as HTMLSelectElement).value).toBe(
      "",
    );
    fireEvent.click(screen.getByRole("button", { name: "自動配置して追加" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ parentNodeId2: null }),
    );
  });

  it("asks for a choice when multiple partners exist", () => {
    render(
      <NodeForm
        mode="add"
        detail={detail()}
        nodes={[
          node("person", "本人", null, "self"),
          node("partner-1", "配偶者1", "person", "partner"),
          node("partner-2", "配偶者2", "person", "partner"),
        ]}
        preset={{ kind: "child", anchorId: "person" }}
        onSubmit={vi.fn()}
      />,
    );

    expect((screen.getByLabelText("配偶者") as HTMLSelectElement).value).toBe(
      "",
    );
    expect(screen.getByText(/配偶者が複数います/)).toBeTruthy();
  });

  it("offers an explicit fix for an existing single-parent child", async () => {
    const child = node("child", "子", "person", "child", {
        parentNodeId1: "person",
      }),
      onChange = vi.fn();
    render(
      <NodeForm
        mode="edit"
        detail={detail([record("child", "person", null)])}
        nodes={[
          node("person", "本人", null, "self"),
          node("partner", "配偶者", "person", "partner"),
          child,
        ]}
        value={child}
        onSubmit={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /配偶者「配偶者」を母に設定/ }),
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          parentNodeId1: "person",
          parentNodeId2: "partner",
        }),
      ),
    );
  });

  it("labels the parent pair as father and mother in node edit mode", () => {
    const child = node("child", "子", "father", "child", {
      parentNodeId1: "father",
      parentNodeId2: "mother",
    });
    render(
      <NodeForm
        mode="edit"
        detail={detail([record("child", "father", "mother")])}
        nodes={[
          child,
          node("father", "父", "child", "parent"),
          node("mother", "母", "child", "parent"),
        ]}
        value={child}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("兄弟姉妹追加時に")).toBeTruthy();
    expect(screen.getByLabelText("父")).toBeTruthy();
    expect(screen.getByLabelText("母")).toBeTruthy();
    expect(screen.queryByLabelText("親1")).toBeNull();
    expect(screen.queryByLabelText("親2")).toBeNull();
  });

  it("uses father and mother labels in sibling quick add mode", () => {
    render(
      <NodeForm
        mode="add"
        detail={detail()}
        nodes={[node("person", "本人", null, "self")]}
        preset={{ kind: "sibling", anchorId: "person" }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("兄弟姉妹追加時に")).toBeTruthy();
    expect(screen.getByLabelText("父")).toBeTruthy();
    expect(screen.getByLabelText("母")).toBeTruthy();
    expect(screen.queryByLabelText("親1")).toBeNull();
    expect(screen.queryByLabelText("親2")).toBeNull();
  });

  it("uses father and mother labels in the regular node add form", () => {
    render(
      <NodeForm
        mode="add"
        detail={detail()}
        nodes={[node("person", "本人", null, "self")]}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("兄弟姉妹追加時に")).toBeTruthy();
    expect(screen.getByLabelText("父")).toBeTruthy();
    expect(screen.getByLabelText("母")).toBeTruthy();
  });

  it("omits the form preview and submits both selected font sizes", () => {
    const onSubmit = vi.fn();
    render(
      <NodeForm
        mode="add"
        detail={detail()}
        nodes={[node("person", "本人", null, "self")]}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByRole("slider", { name: /メモ/ }), {
      target: { value: "24" },
    });
    fireEvent.change(screen.getByRole("slider", { name: /続柄/ }), {
      target: { value: "21" },
    });
    fireEvent.click(screen.getByRole("button", { name: "自動配置して追加" }));

    expect(screen.queryByLabelText("ノードプレビュー")).toBeNull();
    expect(screen.getByText("24px", { selector: "output" })).toBeTruthy();
    expect(screen.getByText("21px", { selector: "output" })).toBeTruthy();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 24, relationshipFontSize: 21 }),
    );
  });

  it("reports edit font and memo drafts without saving", () => {
    const current = node("child", "子", "person", "child", {
        memo: "元のメモ",
      }),
      onDraftChange = vi.fn();
    render(
      <NodeForm
        mode="edit"
        detail={detail([record("child", "person", null)])}
        nodes={[node("person", "本人", null, "self"), current]}
        value={current}
        onSubmit={vi.fn()}
        onDraftChange={onDraftChange}
      />,
    );

    fireEvent.change(screen.getByRole("slider", { name: /メモ/ }), {
      target: { value: "22" },
    });
    expect(onDraftChange).toHaveBeenCalledWith({
      nodeId: "child",
      memo: "元のメモ",
      fontSize: 22,
      relationshipFontSize: 17,
    });
    fireEvent.change(screen.getByRole("slider", { name: /続柄/ }), {
      target: { value: "26" },
    });
    expect(onDraftChange).toHaveBeenCalledWith({
      nodeId: "child",
      memo: "元のメモ",
      fontSize: 22,
      relationshipFontSize: 26,
    });
    fireEvent.change(screen.getByPlaceholderText(/自由に記入できます/), {
      target: { value: "編集中のメモ" },
    });

    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: "child", memo: "編集中のメモ" }),
    );
  });

  it("keeps memo text when the same selected node is re-rendered", () => {
    const current = node("child", "子", "person", "child", {
        memo: "元のメモ",
      }),
      { rerender } = render(
        <NodeForm
          mode="edit"
          detail={detail([record("child", "person", null)])}
          nodes={[node("person", "本人", null, "self"), current]}
          value={current}
          onSubmit={vi.fn()}
        />,
      );
    const memo = screen.getByRole("textbox", { name: /メモ/ });
    fireEvent.change(memo, { target: { value: "入力中のメモ" } });
    rerender(
      <NodeForm
        mode="edit"
        detail={detail([record("child", "person", null)])}
        nodes={[node("person", "本人", null, "self"), { ...current }]}
        value={{ ...current, data: { ...current.data } }}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      (screen.getByRole("textbox", { name: /メモ/ }) as HTMLTextAreaElement)
        .value,
    ).toBe("入力中のメモ");
  });

  it("does not autosave again when the same node is refreshed after saving", async () => {
    const current = node("child", "子", "person", "child"),
      onChange = vi.fn(),
      { rerender } = render(
        <NodeForm
          mode="edit"
          detail={detail([record("child", "person", null)])}
          nodes={[node("person", "本人", null, "self"), current]}
          value={current}
          onSubmit={vi.fn()}
          onChange={onChange}
        />,
      );

    await waitFor(() => expect(onChange).not.toHaveBeenCalled());
    rerender(
      <NodeForm
        mode="edit"
        detail={detail([record("child", "person", null)])}
        nodes={[node("person", "本人", null, "self"), { ...current }]}
        value={{ ...current, data: { ...current.data } }}
        onSubmit={vi.fn()}
        onChange={onChange}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onChange).not.toHaveBeenCalled();
  });
});
