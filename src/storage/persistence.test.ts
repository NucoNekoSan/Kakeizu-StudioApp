// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalApi, localApi, resetStoreCache } from "./localApi";
import { createMemoryStore } from "./kv";

import { writeStorageMode } from "./storageMode";
import { emptyCohabitationDocument } from "../cohabitation";
import { chartKey } from "./repository";
import type { ChartDocumentV1 } from "./chartDocument";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  resetStoreCache();
});
async function setup() {
  const store = createMemoryStore(),
    api = createLocalApi(store);
  const chart = await api.createChart("家族");
  const relationships = await api.relationships(),
    genders = await api.genders();
  const detail = await api.createNode(chart.id, {
    relationshipId: relationships[0].id,
    genderId: genders[0].id,
    anchorNodeId: null,
    parentNodeId1: null,
    parentNodeId2: null,
    placementDirection: null,
    connectionDirection: null,
    divorced: false,
    memo: "",
    fontSize: 16,
    relationshipFontSize: 17,
    scale: 1,
    x: 20,
    y: 30,
  });
  return { store, api, id: chart.id, node: detail.nodes[0] };
}
const labels = {
  ...emptyCohabitationDocument(),
  labels: [{ id: "label", x: 10, y: 20, fontSize: 18 }],
};

describe("storage ordering and backup", () => {
  it("keeps title, node and cohabitation changes from separate API instances", async () => {
    const { store, api, id, node } = await setup();
    const other = createLocalApi(store);
    await Promise.all([
      api.updateNode(id, node.id, { memo: "変更" }),
      other.updateChart(id, "新しい題名"),
      api.updateCohabitation(id, labels),
    ]);
    expect(await api.chart(id)).toMatchObject({
      title: "新しい題名",
      nodes: [{ memo: "変更" }],
      cohabitation: labels,
    });
    const backup = await api.createChartBackup(id);
    const restored = createLocalApi(createMemoryStore());
    await restored.importBackup(backup.json, "replace");
    expect((await restored.chart(id)).cohabitation).toEqual(labels);
  });
  it("serializes definition writes, survives failure and exports the latest committed change", async () => {
    const { api, id, node } = await setup();
    const genders = await api.genders(),
      relationships = await api.relationships();
    await Promise.all([
      api.updateGender(genders[0].id, { name: "更新性別" }),
      api.updateRelationship(relationships[0].id, { name: "更新続柄" }),
    ]);
    expect((await api.genders())[0].name).toBe("更新性別");
    expect((await api.relationships())[0].name).toBe("更新続柄");
    await expect(api.updateNode(id, "invalid", {})).rejects.toThrow();
    const saving = api.updateNode(id, node.id, { memo: "出力直前" });
    const backup = api.createChartBackup(id);
    await saving;
    expect((await backup).backup.charts[0].nodes[0].memo).toBe("出力直前");
  });
  it("cleans cohabitation references when deleting a member", async () => {
    const { api, id, node } = await setup();
    await api.updateCohabitation(id, {
      ...labels,
      cohabitations: [
        {
          id: "group",
          nodeIds: [node.id],
          label: "同居",
          fontSize: 20,
          cx: 20,
          cy: 30,
          rx: 60,
          ry: 60,
        },
      ],
    });
    await api.deleteNode(id, node.id);
    expect((await api.chart(id)).cohabitation).toEqual(labels);
  });
  it("does not touch browser storage in temporary mode", async () => {
    writeStorageMode("session");
    resetStoreCache();
    const write = vi.spyOn(Storage.prototype, "setItem");
    const chart = await localApi.createChart("一時利用");
    await localApi.updateCohabitation(chart.id, labels);
    expect((await localApi.chart(chart.id)).cohabitation).toEqual(labels);
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });
});

describe("legacy migration", () => {
  async function legacy() {
    const result = await setup();
    const document = await result.store.get<ChartDocumentV1>(
      chartKey(result.id),
    );
    delete document!.legacyCohabitationMigrated;
    await result.store.set(chartKey(result.id), document);
    return { ...result, key: `kakeizu:cohabitation-draft:v1:${result.id}` };
  }
  it("prefers the current legacy key and commits before deleting source keys", async () => {
    const { store, api, id, key } = await legacy();
    localStorage.setItem(key, JSON.stringify(labels));
    localStorage.setItem(`kakeizu:cohabitation-labels:${id}`, "[]");
    await createLocalApi(store, { legacyStorage: localStorage }).chart(id);
    expect((await api.chart(id)).cohabitation).toEqual(labels);
    expect(localStorage.getItem(key)).toBeNull();
  });
  it("supports older split keys and charts missing the cohabitation field", async () => {
    const { store, api, id } = await legacy();
    const document = await store.get<Record<string, unknown>>(chartKey(id));
    delete document!.cohabitation;
    await store.set(chartKey(id), document);
    localStorage.setItem(
      `kakeizu:cohabitation-labels:${id}`,
      JSON.stringify(labels.labels),
    );
    await createLocalApi(store, { legacyStorage: localStorage }).chart(id);
    expect((await api.chart(id)).cohabitation).toEqual(labels);
  });
  it("retains malformed source and leaves the chart unchanged", async () => {
    const { store, api, id, key } = await legacy();
    const before = await api.chart(id);
    localStorage.setItem(key, "broken");
    await expect(
      createLocalApi(store, { legacyStorage: localStorage }).chart(id),
    ).rejects.toThrow("移行できません");
    expect(localStorage.getItem(key)).toBe("broken");
    expect(await api.chart(id)).toEqual(before);
  });
  it("retains source on write failure and does not replay stale keys after cleanup failure", async () => {
    const { store, api, id, key } = await legacy();
    localStorage.setItem(key, JSON.stringify(labels));
    const set = vi
      .spyOn(store, "set")
      .mockRejectedValueOnce(new Error("quota"));
    await expect(
      createLocalApi(store, { legacyStorage: localStorage }).chart(id),
    ).rejects.toThrow();
    expect(localStorage.getItem(key)).not.toBeNull();
    set.mockRestore();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await createLocalApi(store, { legacyStorage: localStorage }).chart(id);
    await api.updateCohabitation(id, emptyCohabitationDocument());
    await createLocalApi(store, { legacyStorage: localStorage }).chart(id);
    expect((await api.chart(id)).cohabitation).toEqual(
      emptyCohabitationDocument(),
    );
  });
});
