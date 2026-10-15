// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedNodeUpdate } from "./useDebouncedNodeUpdate";

describe("useDebouncedNodeUpdate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("merges changes for the same chart node", () => {
    const update = vi.fn();
    const { result } = renderHook(() => useDebouncedNodeUpdate(update));

    act(() => {
      result.current.schedule({
        chartId: "chart-a",
        nodeId: "node-a",
        input: { memo: "draft" },
      });
      result.current.schedule({
        chartId: "chart-a",
        nodeId: "node-a",
        input: { fontSize: 20 },
      });
      vi.advanceTimersByTime(500);
    });

    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({
      chartId: "chart-a",
      nodeId: "node-a",
      input: { memo: "draft", fontSize: 20 },
    });
  });

  it("flushes the old target before scheduling another target", () => {
    const update = vi.fn();
    const { result } = renderHook(() => useDebouncedNodeUpdate(update));

    act(() => {
      result.current.schedule({
        chartId: "chart-a",
        nodeId: "node-a",
        input: { memo: "first" },
      });
      result.current.schedule({
        chartId: "chart-a",
        nodeId: "node-b",
        input: { memo: "second" },
      });
    });
    expect(update).toHaveBeenLastCalledWith({
      chartId: "chart-a",
      nodeId: "node-a",
      input: { memo: "first" },
    });

    act(() => vi.advanceTimersByTime(500));
    expect(update).toHaveBeenLastCalledWith({
      chartId: "chart-a",
      nodeId: "node-b",
      input: { memo: "second" },
    });
  });

  it("keeps the scheduled target when the callback changes", () => {
    const firstUpdate = vi.fn();
    const latestUpdate = vi.fn();
    const { result, rerender } = renderHook(
      ({ update }) => useDebouncedNodeUpdate(update),
      { initialProps: { update: firstUpdate } },
    );

    act(() =>
      result.current.schedule({
        chartId: "chart-a",
        nodeId: "node-a",
        input: { memo: "draft" },
      }),
    );
    rerender({ update: latestUpdate });
    act(() => vi.advanceTimersByTime(500));

    expect(firstUpdate).not.toHaveBeenCalled();
    expect(latestUpdate).toHaveBeenCalledWith({
      chartId: "chart-a",
      nodeId: "node-a",
      input: { memo: "draft" },
    });
  });

  it("cancels only a matching target and flushes on unmount", () => {
    const update = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDebouncedNodeUpdate(update),
    );
    act(() => {
      result.current.schedule({
        chartId: "chart-a",
        nodeId: "node-a",
        input: { memo: "draft" },
      });
      result.current.cancelTarget({ chartId: "chart-a", nodeId: "node-b" });
    });
    unmount();
    expect(update).toHaveBeenCalledOnce();

    const second = renderHook(() => useDebouncedNodeUpdate(update));
    act(() => {
      second.result.current.schedule({
        chartId: "chart-a",
        nodeId: "node-a",
        input: { memo: "discard" },
      });
      second.result.current.cancelTarget({
        chartId: "chart-a",
        nodeId: "node-a",
      });
    });
    second.unmount();
    expect(update).toHaveBeenCalledOnce();
  });
  it("waits for a previously started save before resolving flushAndWait", async () => {
    let release!: () => void;
    const update = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { result } = renderHook(() => useDebouncedNodeUpdate(update));
    act(() => {
      result.current.schedule({
        chartId: "a",
        nodeId: "n",
        input: { memo: "draft" },
      });
      vi.advanceTimersByTime(500);
    });
    let complete = false;
    let waiting!: Promise<void>;
    act(() => {
      waiting = result.current.flushAndWait().then(() => {
        complete = true;
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(complete).toBe(false);
    await act(async () => {
      release();
      await waiting;
    });
    expect(complete).toBe(true);
  });
  it("retries failed fields together with newer edits", async () => {
    const update = vi
      .fn()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useDebouncedNodeUpdate(update));
    await act(async () => {
      result.current.schedule({
        chartId: "a",
        nodeId: "n",
        input: { memo: "keep" },
      });
      vi.advanceTimersByTime(500);
    });
    act(() =>
      result.current.schedule({
        chartId: "a",
        nodeId: "n",
        input: { fontSize: 24 },
      }),
    );
    await act(() => result.current.flushAndWait());
    expect(update).toHaveBeenLastCalledWith({
      chartId: "a",
      nodeId: "n",
      input: { memo: "keep", fontSize: 24 },
    });
    expect(result.current.isPending).toBe(false);
  });
});
