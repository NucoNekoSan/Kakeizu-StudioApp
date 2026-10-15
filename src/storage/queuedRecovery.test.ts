import { describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "./kv";
import { createLocalApi } from "./localApi";
import { chartKey, DEFINITIONS_KEY, META_KEY } from "./repository";
import type { ChartDocumentV1 } from "./chartDocument";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));
const brokenId = "f".repeat(32);
async function setup() {
  const store = createMemoryStore(),
    api = createLocalApi(store);
  const chart = await api.createChart("restored");
  const backup = await api.createBackup();
  await api.updateChart(chart.id, "old");
  return { store, api, chart, backup };
}
describe("queued recovery waits for failed reads to settle", () => {
  it.each(["replace", "clear"])(
    "finishes migration before queued %s and never replays the old data",
    async (action) => {
      const { store, chart, backup } = await setup();
      const document = await store.get<ChartDocumentV1>(chartKey(chart.id));
      delete document!.legacyCohabitationMigrated;
      await store.set(chartKey(chart.id), document);
      await store.set(chartKey(brokenId), { broken: true });
      const entered = deferred(),
        release = deferred(),
        committed = deferred();
      const get = store.get,
        set = store.set;
      let blocked = false;
      vi.spyOn(store, "get").mockImplementation(async (key) => {
        const value = await get(key);
        if (!blocked && key === chartKey(chart.id)) {
          blocked = true;
          entered.resolve();
          await release.promise;
        }
        return value;
      });
      vi.spyOn(store, "set").mockImplementation(async (key, value) => {
        await set(key, value);
        if (key === chartKey(chart.id)) committed.resolve();
      });
      const api = createLocalApi(store, {
        legacyStorage: { getItem: () => null, removeItem: () => undefined },
      });
      const listing = api.charts().catch((error) => error);
      await entered.promise;
      const replacement = vi.spyOn(store, "replaceAll"),
        clearing = vi.spyOn(store, "clear");
      const recovery =
        action === "replace"
          ? api.importBackup(backup.json, "replace")
          : api.clearAllData();
      await nextTurn();
      expect(replacement).not.toHaveBeenCalled();
      expect(clearing).not.toHaveBeenCalled();
      release.resolve();
      expect((await listing).code).toBe("DOCUMENT_CORRUPTED");
      await committed.promise;
      await recovery;
      if (action === "replace")
        expect((await api.chart(chart.id)).title).toBe("restored");
      else expect(await api.charts()).toEqual([]);
      await nextTurn();
      if (action === "replace")
        expect(
          (await store.get<ChartDocumentV1>(chartKey(chart.id)))!.title,
        ).toBe("restored");
      else expect(await store.keys()).toEqual([]);
    },
  );
  it.each([
    "createBackup",
    "createChartBackup",
    "relationships",
    "genders",
  ] as const)(
    "finishes definition initialization after %s fails before restoring",
    async (method) => {
      const { store, api, backup } = await setup();
      await store.del(DEFINITIONS_KEY);
      await store.set(chartKey(brokenId), { broken: true });
      const entered = deferred(),
        release = deferred(),
        committed = deferred();
      const set = store.set;
      vi.spyOn(store, "set").mockImplementation(async (key, value) => {
        if (key === DEFINITIONS_KEY) {
          entered.resolve();
          await release.promise;
        }
        await set(key, value);
        if (key === DEFINITIONS_KEY) committed.resolve();
      });
      const reading = (
        method === "createChartBackup"
          ? api.createChartBackup(brokenId)
          : api[method]()
      ).catch((error) => error);
      await entered.promise;
      const replacement = vi.spyOn(store, "replaceAll");
      const restoring = api.importBackup(backup.json, "replace");
      await nextTurn();
      expect(replacement).not.toHaveBeenCalled();
      release.resolve();
      expect((await reading).code).toBe("DOCUMENT_CORRUPTED");
      await committed.promise;
      await restoring;
      expect((await api.relationships()).map((item) => item.id)).toEqual(
        backup.backup.definitions.relationships.map((item) => item.id),
      );
    },
  );
  it("finishes metadata initialization after status fails before clearing", async () => {
    const { store, api } = await setup();
    const entered = deferred(),
      release = deferred();
    const set = store.set;
    vi.spyOn(store, "set").mockImplementation(async (key, value) => {
      if (key === META_KEY) {
        entered.resolve();
        await release.promise;
      }
      await set(key, value);
    });
    const failure = new Error("keys unavailable");
    vi.spyOn(store, "keys").mockRejectedValueOnce(failure);
    const status = api.backupStatus().catch((error) => error);
    await entered.promise;
    const clearing = vi.spyOn(store, "clear");
    const cleared = api.clearAllData();
    await nextTurn();
    expect(clearing).not.toHaveBeenCalled();
    release.resolve();
    expect(await status).toBe(failure);
    await cleared;
    expect(await store.keys()).toEqual([]);
  });
});
