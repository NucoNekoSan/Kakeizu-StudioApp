import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SaveLedger, type SaveChange } from "./saveLedger";

export type SaveState = "saved" | "saving" | "error";

/** Register at dispatch time, and judge errors only after all writes settle. */
export function useSaveTracker(onState?: (state: SaveState) => void) {
  const [snapshot, setSnapshot] = useState<{
    state: SaveState;
    error: unknown;
  }>({ state: "saved", error: null });
  const ledger = useRef(new SaveLedger());
  const pending = useRef(new Set<Promise<unknown>>());
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callback = useRef(onState);
  callback.current = onState;
  const publish = useCallback((state: SaveState) => {
    if (!mounted.current) return;
    setSnapshot({ state, error: ledger.current.errorFor() });
    callback.current?.(state);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  const track = useCallback(
    <T>(
      change: SaveChange | readonly SaveChange[],
      operation: () => Promise<T>,
    ): Promise<T> => {
      clearTimeout(timer.current);
      const attempt = ledger.current.begin(change);
      publish("saving");
      const started = Date.now();
      const promise = Promise.resolve().then(operation);
      pending.current.add(promise);
      const finish = (error: unknown = null) => {
        ledger.current.settle(attempt, error);
        pending.current.delete(promise);
        if (!mounted.current) return;
        if (pending.current.size) {
          publish("saving");
          return;
        }
        if (ledger.current.errorFor() !== null) publish("error");
        else {
          publish("saving");
          timer.current = setTimeout(
            () => publish("saved"),
            Math.max(0, 500 - (Date.now() - started)),
          );
        }
      };
      void promise.then(
        () => finish(),
        (error) => finish(error),
      );
      return promise;
    },
    [publish],
  );
  const wait = useCallback(async () => {
    while (pending.current.size) await Promise.allSettled([...pending.current]);
    const error = ledger.current.errorFor();
    if (error !== null) throw error;
  }, []);
  const errorFor = useCallback(
    (target: string) => ledger.current.errorFor(target),
    [],
  );
  const forget = useCallback(
    (target: string) => {
      ledger.current.forget(target);
      publish(
        pending.current.size
          ? "saving"
          : ledger.current.errorFor() !== null
            ? "error"
            : "saved",
      );
    },
    [publish],
  );
  return useMemo(
    () => ({ ...snapshot, track, wait, errorFor, forget }),
    [snapshot, track, wait, errorFor, forget],
  );
}
export type SaveTracker = ReturnType<typeof useSaveTracker>;
