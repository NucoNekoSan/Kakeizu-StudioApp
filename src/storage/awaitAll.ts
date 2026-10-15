/** Wait for every started operation, including writes hidden inside reads. */
export async function awaitAll<const T extends readonly Promise<unknown>[]>(
  operations: T,
): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  const results = await Promise.allSettled(operations);
  // Preserve the original error, deterministically in input order.
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
  }
  // These same promises have already succeeded; this preserves tuple typing.
  return Promise.all(operations);
}
