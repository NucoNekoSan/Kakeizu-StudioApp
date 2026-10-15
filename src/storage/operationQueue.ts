import type { DocumentStore } from "./kv";

const queues = new WeakMap<DocumentStore, Promise<unknown>>();

/** Share ordering even when multiple API instances use the same store. */
export function enqueue<T>(
  store: DocumentStore,
  operation: () => Promise<T>,
): Promise<T> {
  const result = (queues.get(store) ?? Promise.resolve()).then(operation);
  queues.set(
    store,
    result.catch(() => undefined),
  );
  return result;
}

export function orderedApi<T extends object>(store: DocumentStore, api: T): T {
  return Object.fromEntries(
    Object.entries(api).map(([name, operation]) => [
      name,
      (...args: unknown[]) => enqueue(store, () => operation(...args)),
    ]),
  ) as T;
}
