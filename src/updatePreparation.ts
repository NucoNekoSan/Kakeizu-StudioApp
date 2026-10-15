const preparations = new Set<() => Promise<void>>();

/** Editors register their pending draft/auto-save flush while mounted. */
export function registerUpdatePreparation(prepare: () => Promise<void>) {
  preparations.add(prepare);
  return () => {
    preparations.delete(prepare);
  };
}

export async function prepareForUpdate(): Promise<void> {
  const results = await Promise.allSettled(
    [...preparations].map((prepare) => prepare()),
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
}
