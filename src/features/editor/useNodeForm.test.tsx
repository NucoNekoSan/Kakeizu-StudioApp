// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartDetail, ChartNodeRecord, RelationKind } from "../../types";
import { seedDefinitions } from "../../storage/defaults";
import { hydrateChart } from "./hydrateChart";
import {
  buildNodeFormSubmission,
  initialNodeFormValues,
  nodeFormChoices,
} from "./nodeFormModel";
import { useNodeForm, type NodeFormProps } from "./useNodeForm";

afterEach(cleanup);

function fixture() {
  const definitions = seedDefinitions();
  const makeRecord = (
    id: string,
    kind: RelationKind,
    overrides: Partial<ChartNodeRecord> = {},
  ): ChartNodeRecord => ({
    id,
    relationshipId: definitions.relationships.find((r) => r.kind === kind)!.id,
    genderId: definitions.genders[0].id,
    anchorNodeId: null,
    parentNodeId1: null,
    parentNodeId2: null,
    placementDirection: "right",
    connectionDirection: null,
    divorced: false,
    memo: id,
    fontSize: 16,
    relationshipFontSize: 17,
    scale: 1,
    x: 100,
    y: 120,
    ...overrides,
  });
  const detail: ChartDetail = {
    ...definitions,
    id: "chart",
    title: "Family",
    updatedAt: "2026-10-15T00:00:00Z",
    cohabitation: { version: 1, cohabitations: [], labels: [] },
    edges: [],
    nodes: [
      makeRecord("self", "self"),
      makeRecord("partner", "partner", {
        anchorNodeId: "self",
        x: 400,
        memo: "Partner",
        fontSize: 22,
      }),
    ],
  };
  const nodes = hydrateChart(detail).nodes;
  const props: NodeFormProps = {
    mode: "edit",
    detail,
    nodes,
    value: nodes[0],
    onSubmit: vi.fn(),
    onChange: vi.fn(),
    onDraftChange: vi.fn(),
  };
  return { props, nodes, detail };
}

describe("node form state and notifications", () => {
  it("keeps an unsaved draft through refresh, but hydrates a different selected person without saving", () => {
    const { props, nodes } = fixture();
    const { result, rerender } = renderHook(useNodeForm, {
      initialProps: props,
    });
    act(() => result.current.changeMemo("Unsaved"));
    vi.mocked(props.onChange!).mockClear();
    rerender({
      ...props,
      value: { ...nodes[0], data: { ...nodes[0].data, memo: "Stale" } },
    });
    expect(result.current.memo).toBe("Unsaved");
    rerender({ ...props, value: nodes[1] });
    expect(result.current.memo).toBe("Partner");
    expect(result.current.fontSize).toBe(22);
    expect(result.current.anchorNodeId).toBe("self");
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.onDraftChange).toHaveBeenLastCalledWith(null);
  });

  it("notifies once per input with the latest text and both font sizes", () => {
    const { props } = fixture();
    const { result, rerender } = renderHook(useNodeForm, {
      initialProps: props,
    });
    act(() => result.current.changeMemo("Draft"));
    expect(props.onChange).toHaveBeenLastCalledWith({ memo: "Draft" });
    expect(
      vi.mocked(props.onDraftChange!).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(props.onChange!).mock.invocationCallOrder[0]);
    act(() => result.current.changeFontSize(24));
    expect(props.onChange).toHaveBeenLastCalledWith({
      fontSize: 24,
      relationshipFontSize: 17,
    });
    act(() => result.current.changeRelationshipFontSize(28));
    expect(props.onChange).toHaveBeenLastCalledWith({
      fontSize: 24,
      relationshipFontSize: 28,
    });
    expect(props.onDraftChange).toHaveBeenLastCalledWith({
      nodeId: "self",
      memo: "Draft",
      fontSize: 24,
      relationshipFontSize: 28,
    });
    rerender({ ...props, onChange: (input) => props.onChange?.(input) });
    expect(props.onChange).toHaveBeenCalledTimes(3);
  });

  it("add-mode edits stay local until submission", () => {
    const { props } = fixture();
    const { result } = renderHook(useNodeForm, {
      initialProps: { ...props, mode: "add", value: null },
    });
    act(() => result.current.changeMemo("New"));
    act(() => result.current.changeFontSize(25));
    act(() => result.current.changeParent1("self"));
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.onDraftChange).not.toHaveBeenCalled();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});

describe("node form calculations", () => {
  it("initializes a child from the only partner and inherits parents for a sibling", () => {
    const { props, detail, nodes } = fixture();
    const child = initialNodeFormValues({
      ...props,
      mode: "add",
      value: null,
      preset: { kind: "child", anchorId: "self" },
    });
    expect(child.parentNodeId1).toBe("self");
    expect(child.parentNodeId2).toBe("partner");
    expect(child.placementDirection).toBe("below");
    const siblingNodes = [
      {
        ...nodes[0],
        data: {
          ...nodes[0].data,
          parentNodeId1: "father",
          parentNodeId2: "mother",
        },
      },
    ];
    const sibling = initialNodeFormValues({
      mode: "add",
      detail,
      nodes: siblingNodes,
      preset: { kind: "sibling", anchorId: "self" },
    });
    expect(sibling.parentNodeId1).toBe("father");
    expect(sibling.parentNodeId2).toBe("mother");
    expect(sibling.placementDirection).toBe("right");
  });

  it("keeps an inactive selected definition available without offering unrelated inactive definitions", () => {
    const { props, detail } = fixture();
    const disabled = {
      ...detail,
      relationships: detail.relationships.map((r) => ({ ...r, active: false })),
      genders: detail.genders.map((g) => ({ ...g, active: false })),
    };
    const choices = nodeFormChoices({ ...props, detail: disabled });
    expect(choices.activeR.map((r) => r.id)).toEqual([
      props.value!.data.relationshipId,
    ]);
    expect(choices.activeG.map((g) => g.id)).toEqual([
      props.value!.data.genderId,
    ]);
  });

  it("preserves edit coordinates and scale while limiting the submitted memo", () => {
    const { props, nodes } = fixture();
    const context = {
      ...props,
      value: { ...nodes[1], data: { ...nodes[1].data, scale: 1.5 } },
    };
    const values = {
      ...initialNodeFormValues(context),
      memo: "x".repeat(2001),
      fontSize: 24,
      relationshipFontSize: 28,
    };
    const submitted = buildNodeFormSubmission(context, values);
    expect(submitted).toMatchObject({
      x: 400,
      y: 120,
      scale: 1.5,
      fontSize: 24,
      relationshipFontSize: 28,
    });
    expect(submitted.memo).toHaveLength(2000);
    expect(values.memo).toHaveLength(2001);
  });
});
