import { expect, it, vi } from "vitest";
import { createMemoryStore } from "./kv";
import { createLocalApi } from "./localApi";
import type { ChartDocumentV1 } from "./chartDocument";

// 大容量の割り当てを避け、実際と同じ判定を小さな上限で検証する。
vi.mock("./importLimits", async (original) => ({
  ...(await original<typeof import("./importLimits")>()),
  BACKUP_MAX_BYTES: 30_000,
}));

it("暗号化前が上限内でも、暗号化後に超えるファイルは出力しない", async () => {
  const store = createMemoryStore(),
    api = createLocalApi(store);
  const chart = await api.createChart("容量検証");
  const r = (await api.relationships())[0],
    g = (await api.genders())[0];
  await api.createNode(chart.id, {
    relationshipId: r.id,
    genderId: g.id,
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
    x: 0,
    y: 0,
  });
  const baseline = await api.createBackup();
  const document = (await store.get<ChartDocumentV1>(`chart:${chart.id}`))!;
  const padding = 24_000 - new TextEncoder().encode(baseline.json).length;
  document.nodes[0] = {
    ...document.nodes[0],
    futureField: "x".repeat(padding),
  } as (typeof document.nodes)[0];
  await store.set(`chart:${chart.id}`, document);
  const plain = await api.createBackup();
  expect(new TextEncoder().encode(plain.json).length).toBeLessThan(30_000);
  expect((await api.inspectBackup(plain.json)).chartCount).toBe(1);
  await expect(api.createBackup("容量検証の合言葉")).rejects.toMatchObject({
    code: "BACKUP_EXPORT_LIMIT",
  });
  document.nodes[0] = {
    ...document.nodes[0],
    futureField: "x".repeat(40_000),
  } as (typeof document.nodes)[0];
  await store.set(`chart:${chart.id}`, document);
  await expect(api.createBackup()).rejects.toMatchObject({
    code: "BACKUP_EXPORT_LIMIT",
  });
  await expect(api.createChartBackup(chart.id)).rejects.toMatchObject({
    code: "BACKUP_EXPORT_LIMIT",
  });
});
