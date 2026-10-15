// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useSaveTracker } from "./useSaveTracker";
afterEach(cleanup);
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
describe("useSaveTracker", () => {
  it("waits through an old rejection and accepts a successful replacement", async () => {
    const first = deferred(),
      second = deferred();
    const { result } = renderHook(() => useSaveTracker());
    let waiting!: Promise<void>,
      complete = false;
    act(() => {
      void result.current.track(
        { target: "node", fields: ["memo"] },
        () => first.promise,
      );
      void result.current.track(
        { target: "node", fields: ["memo"] },
        () => second.promise,
      );
      waiting = result.current.wait().then(() => {
        complete = true;
      });
    });
    await act(async () => {
      first.reject(new Error("old"));
      await Promise.resolve();
    });
    expect(complete).toBe(false);
    await act(async () => {
      second.resolve();
      await waiting;
    });
    expect(complete).toBe(true);
    expect(result.current.error).toBeNull();
    await expect(result.current.wait()).resolves.toBeUndefined();
  });
  it("keeps a failed field when only another field succeeds", async () => {
    const first = deferred(),
      second = deferred(),
      failure = new Error("memo failed");
    const { result } = renderHook(() => useSaveTracker());
    act(() => {
      void result.current.track(
        { target: "node", fields: ["memo", "fontSize"] },
        () => first.promise,
      );
      void result.current.track(
        { target: "node", fields: ["fontSize"] },
        () => second.promise,
      );
    });
    await act(async () => {
      first.reject(failure);
      second.resolve();
      await Promise.allSettled([first.promise, second.promise]);
    });
    await expect(result.current.wait()).rejects.toBe(failure);
    expect(result.current.errorFor("node")).toBe(failure);
    await act(() =>
      result.current.track(
        { target: "node", fields: ["memo"] },
        async () => undefined,
      ),
    );
    await expect(result.current.wait()).resolves.toBeUndefined();
    expect(result.current.error).toBeNull();
  });
});
