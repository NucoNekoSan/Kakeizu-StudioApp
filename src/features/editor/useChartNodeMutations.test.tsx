// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import type { ChartDetail } from "../../types";
import { useChartNodeMutations } from "./useChartNodeMutations";

vi.mock("../../api", () => ({
  api: {
    createNode: vi.fn(),
    updateNode: vi.fn(),
    updateNodeLayout: vi.fn(),
    deleteNode: vi.fn(),
  },
}));

function detail(id: string, title: string): ChartDetail {
  return {
    id,
    title,
    updatedAt: "2026-09-11T00:00:00Z",
    nodes: [],
    edges: [],
    relationships: [],
    genders: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useChartNodeMutations", () => {
  it("saves both frame dimensions with the layout", async () => {
    vi.mocked(api.updateNodeLayout).mockResolvedValueOnce(
      detail("chart-a", "frame"),
    );
    const { result } = renderHook(
      () => useChartNodeMutations("chart-a", vi.fn(), vi.fn(), vi.fn()),
      { wrapper: createWrapper() },
    );
    await act(() =>
      result.current.frame.mutateAsync({
        width: 1800,
        height: 600,
        layouts: [],
      }),
    );
    expect(api.updateNodeLayout).toHaveBeenCalledWith("chart-a", [], 1800, 600);
  });
  it("serializes chart writes and stays saving until all writes settle", async () => {
    const first = deferred<ChartDetail>();
    const second = deferred<ChartDetail>();
    vi.mocked(api.updateNode)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const refresh = vi.fn();
    const setSaveState = vi.fn();
    const { result } = renderHook(
      () => useChartNodeMutations("chart-a", refresh, setSaveState, vi.fn()),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.update.mutate({
        chartId: "chart-a",
        nodeId: "node-a",
        input: { memo: "first" },
      });
      result.current.update.mutate({
        chartId: "chart-a",
        nodeId: "node-a",
        input: { memo: "second" },
      });
    });
    await waitFor(() => expect(api.updateNode).toHaveBeenCalledTimes(1));
    expect(setSaveState).toHaveBeenLastCalledWith("saving");

    first.resolve(detail("chart-a", "first"));
    await waitFor(() => expect(api.updateNode).toHaveBeenCalledTimes(2));
    expect(setSaveState).toHaveBeenLastCalledWith("saving");

    second.resolve(detail("chart-a", "second"));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    await waitFor(
      () => expect(setSaveState).toHaveBeenLastCalledWith("saved"),
      {
        timeout: 1000,
      },
    );
    expect(refresh.mock.calls.map(([value]) => value.title)).toEqual([
      "first",
      "second",
    ]);
  });

  it("uses the chart id carried by the update and reports a batch error", async () => {
    vi.mocked(api.updateNode).mockRejectedValueOnce(new Error("failed"));
    const setSaveState = vi.fn();
    const { result } = renderHook(
      () =>
        useChartNodeMutations("current-chart", vi.fn(), setSaveState, vi.fn()),
      { wrapper: createWrapper() },
    );

    act(() =>
      result.current.update.mutate({
        chartId: "original-chart",
        nodeId: "node-a",
        input: { memo: "draft" },
      }),
    );

    await waitFor(() =>
      expect(api.updateNode).toHaveBeenCalledWith("original-chart", "node-a", {
        memo: "draft",
      }),
    );
    await waitFor(() => expect(setSaveState).toHaveBeenLastCalledWith("error"));
  });
});
