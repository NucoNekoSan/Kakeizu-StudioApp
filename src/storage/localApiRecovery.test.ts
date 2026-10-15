// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIndexedDbStore, createMemoryStore } from "./kv";
import { createLocalApi, localApi, resetStoreCache } from "./localApi";
import { chartKey } from "./repository";
import { writeStorageMode } from "./storageMode";
import type { ChartDocumentV1 } from "./chartDocument";
vi.mock("./kv", async (original) => ({
  ...(await original<typeof import("./kv")>()),
  createIndexedDbStore: vi.fn(),
}));
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetStoreCache();
  vi.resetAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
  resetStoreCache();
});
async function setup() {
  const store = createMemoryStore(),
    api = createLocalApi(store);
  const healthy = await api.createChart("正常"),
    legacy = await api.createChart("旧データ");
  const backup = await api.createBackup();
  const document = await store.get<ChartDocumentV1>(chartKey(legacy.id));
  delete document!.legacyCohabitationMigrated;
  await store.set(chartKey(legacy.id), document);
  vi.mocked(createIndexedDbStore).mockResolvedValue(store);
  return { store, healthy, legacy, backup };
}
describe("recovery without eagerly decoding stored charts", () => {
  it.each(["chart", "legacy"])(
    "keeps recovery available with a corrupt %s",
    async (kind) => {
      const { store, healthy, legacy, backup } = await setup();
      if (kind === "chart")
        await store.set(chartKey(legacy.id), { broken: true });
      else
        localStorage.setItem(
          `kakeizu:cohabitation-draft:v1:${legacy.id}`,
          "broken",
        );
      // A cold API must inspect the backup without migrating any stored chart.
      expect((await localApi.inspectBackup(backup.json)).chartCount).toBe(2);
      await expect(localApi.chart(legacy.id)).rejects.toThrow();
      expect((await localApi.chart(healthy.id)).title).toBe("正常");
      await expect(localApi.charts()).rejects.toThrow();
      resetStoreCache();
      await localApi.importBackup(backup.json, "replace");
      expect((await localApi.chart(legacy.id)).title).toBe("旧データ");
      if (kind === "chart")
        await store.set(chartKey(legacy.id), { broken: true });
      else {
        const document = await store.get<ChartDocumentV1>(chartKey(legacy.id));
        delete document!.legacyCohabitationMigrated;
        await store.set(chartKey(legacy.id), document);
      }
      resetStoreCache();
      await localApi.clearAllData();
      expect(await localApi.charts()).toEqual([]);
    },
  );
  it("does not migrate another chart or change its timestamp while opening one chart", async () => {
    const { store, healthy, legacy } = await setup();
    const source = await store.get<ChartDocumentV1>(chartKey(legacy.id));
    localStorage.setItem(
      `kakeizu:cohabitation-draft:v1:${legacy.id}`,
      "broken",
    );
    await localApi.chart(healthy.id);
    expect(await store.get(chartKey(legacy.id))).toEqual(source);
    localStorage.removeItem(`kakeizu:cohabitation-draft:v1:${legacy.id}`);
    await localApi.chart(legacy.id);
    expect(
      (await store.get<ChartDocumentV1>(chartKey(legacy.id)))!.updatedAt,
    ).toBe(source!.updatedAt);
  });
  it("does not read legacy data in temporary mode or after storage fallback", async () => {
    const { store, legacy } = await setup();
    const read = vi.spyOn(Storage.prototype, "getItem");
    writeStorageMode("session");
    await localApi.createChart("一時利用");
    expect(createIndexedDbStore).not.toHaveBeenCalled();
    expect(read.mock.calls.some(([key]) => key.includes("cohabitation"))).toBe(
      false,
    );
    sessionStorage.clear();
    resetStoreCache();
    vi.spyOn(store, "keys").mockRejectedValue(
      new Error("IndexedDB unavailable"),
    );
    await localApi.createChart("フォールバック");
    expect(read.mock.calls.some(([key]) => key.includes(legacy.id))).toBe(
      false,
    );
  });
});
