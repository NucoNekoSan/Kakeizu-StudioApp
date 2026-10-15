import { describe, expect, it } from "vitest";
import { awaitAll } from "./awaitAll";

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
describe("awaitAll", () => {
  it("does not report an error while another operation can still write", async () => {
    const delayed = deferred<number>(),
      failure = new Error("failed");
    let finished = false;
    const outcome = awaitAll([Promise.reject(failure), delayed.promise]).catch(
      (error) => {
        finished = true;
        return error;
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(finished).toBe(false);
    delayed.resolve(1);
    expect(await outcome).toBe(failure);
  });
  it("reports the first error in input order even when it fails later", async () => {
    const first = deferred<number>(),
      failure = new Error("first input");
    const outcome = awaitAll([
      first.promise,
      Promise.reject(new Error("second input")),
    ]).catch((error) => error);
    first.reject(failure);
    expect(await outcome).toBe(failure);
  });
  it("preserves values and order when all operations succeed", async () => {
    expect(
      await awaitAll([Promise.resolve(3), Promise.resolve("ready")]),
    ).toEqual([3, "ready"]);
    expect(await awaitAll([])).toEqual([]);
  });
});
