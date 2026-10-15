// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTitleDraft } from "./useTitleDraft";
afterEach(cleanup);
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
describe("useTitleDraft", () => {
  it("includes a reversion entered while a flush is already waiting", async () => {
    const first = deferred(),
      second = deferred();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useTitleDraft("A", save));
    act(() => result.current.onChange("B"));
    let waiting!: Promise<void>;
    act(() => {
      waiting = result.current.flushAndWait();
    });
    act(() => result.current.onChange("A"));
    await act(async () => first.resolve());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("A");
    expect(result.current.isDirty).toBe(true);
    await act(async () => {
      second.resolve();
      await waiting;
    });
    expect(result.current.value).toBe("A");
    expect(result.current.isDirty).toBe(false);
  });
  it("continues with the newest generation after an older write fails", async () => {
    const first = deferred();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useTitleDraft("A", save));
    act(() => result.current.onChange("B"));
    let waiting!: Promise<void>;
    act(() => {
      waiting = result.current.flushAndWait();
    });
    act(() => result.current.onChange("C"));
    await act(async () => {
      first.reject(new Error("old"));
      await waiting;
    });
    expect(save.mock.calls.map(([title]) => title)).toEqual(["B", "C"]);
    expect(result.current.value).toBe("C");
    expect(result.current.isDirty).toBe(false);
  });
  it("retains a failed latest generation and retries it explicitly", async () => {
    const failure = new Error("latest failed");
    const save = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useTitleDraft("A", save));
    act(() => result.current.onChange("B"));
    await act(async () => {
      await expect(result.current.flushAndWait()).rejects.toBe(failure);
    });
    expect(result.current.value).toBe("B");
    expect(result.current.isDirty).toBe(true);
    await act(() => result.current.flushAndWait());
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.isDirty).toBe(false);
  });
});
