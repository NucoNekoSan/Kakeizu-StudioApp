import { useCallback, useEffect, useRef, useState } from "react";
import type { ChartNodeRecord } from "../../types";

export interface NodeUpdateTarget {
  chartId: string;
  nodeId: string;
}

export interface PendingNodeUpdate extends NodeUpdateTarget {
  input: Partial<Omit<ChartNodeRecord, "id">>;
}

type Update = (request: PendingNodeUpdate) => void | Promise<unknown>;

function hasSameTarget(current: NodeUpdateTarget, next: NodeUpdateTarget) {
  return current.chartId === next.chartId && current.nodeId === next.nodeId;
}

export function useDebouncedNodeUpdate(update: Update, delay = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<PendingNodeUpdate | null>(null);
  const unsaved = useRef(new Map<string, PendingNodeUpdate>());
  const targetKey = (target: NodeUpdateTarget) =>
    `${target.chartId}:${target.nodeId}`;
  const updateRef = useRef(update);
  const inFlight = useRef(new Map<Promise<unknown>, PendingNodeUpdate>());
  const [isPending, setPending] = useState(false);
  useEffect(() => {
    updateRef.current = update;
  }, [update]);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (!next) return Promise.resolve();
    const result = Promise.resolve(updateRef.current(next));
    inFlight.current.set(result, next);
    void result.then(
      () => {
        inFlight.current.delete(result);
        const key = targetKey(next);
        if (unsaved.current.get(key) === next) unsaved.current.delete(key);
        setPending(unsaved.current.size > 0);
      },
      () => {
        inFlight.current.delete(result);
      },
    );
    return result;
  }, []);
  const schedule = useCallback(
    (request: PendingNodeUpdate) => {
      const current = pending.current;
      if (current && !hasSameTarget(current, request))
        void flush().catch(() => undefined);
      setPending(true);
      const key = targetKey(request);
      pending.current = {
        chartId: request.chartId,
        nodeId: request.nodeId,
        input: { ...unsaved.current.get(key)?.input, ...request.input },
      };
      unsaved.current.set(key, pending.current);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush().catch(() => undefined);
      }, delay);
    },
    [delay, flush],
  );
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    unsaved.current.clear();
    setPending(false);
  }, []);
  const cancelTarget = useCallback((target: NodeUpdateTarget) => {
    unsaved.current.delete(targetKey(target));
    if (!pending.current || !hasSameTarget(pending.current, target)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    setPending(false);
  }, []);
  const flushAndWait = useCallback(async () => {
    const attempted = new Set(inFlight.current.values());
    for (;;) {
      // Retry existing failures once, and include drafts added while waiting.
      for (const request of [...unsaved.current.values()]) {
        if (attempted.has(request)) continue;
        attempted.add(request);
        if ([...inFlight.current.values()].includes(request)) continue;
        pending.current = request;
        void flush().catch(() => undefined);
      }
      await Promise.allSettled([...inFlight.current.keys()]);
      if (
        ![...unsaved.current.values()].some(
          (request) => !attempted.has(request),
        )
      )
        return;
    }
  }, [flush]);
  useEffect(
    () => () => {
      void flush().catch(() => undefined);
    },
    [flush],
  );
  return {
    schedule,
    flush,
    flushAndWait,
    cancel,
    cancelTarget,
    isPending,
  };
}
