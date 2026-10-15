import { describe, expect, it, vi } from "vitest";
import { createLocalApi } from "./localApi";
import { createMemoryStore } from "./kv";
import { chartKey } from "./repository";
import type { ChartDocumentV1 } from "./chartDocument";
import type { ChartNodeRecord } from "../types";
import { parseBackup } from "./backupModel";

async function family() {
  const store = createMemoryStore(),
    api = createLocalApi(store);
  const chart = await api.createChart("家族");
  const relationships = await api.relationships(),
    genders = await api.genders();
  const relation = (kind: "self" | "partner" | "child") =>
    relationships.find((item) => item.kind === kind)!.id;
  const base: Omit<ChartNodeRecord, "id"> = {
    relationshipId: relation("self"),
    genderId: genders[0].id,
    anchorNodeId: null,
    parentNodeId1: null,
    parentNodeId2: null,
    placementDirection: "below",
    connectionDirection: null,
    divorced: false,
    memo: "",
    fontSize: 16,
    relationshipFontSize: 17,
    scale: 1,
    x: 120,
    y: 240,
  };
  const first = (await api.createNode(chart.id, base)).nodes[0];
  const second = (
    await api.createNode(chart.id, {
      ...base,
      relationshipId: relation("partner"),
      anchorNodeId: first.id,
    })
  ).nodes[1];
  const child = (
    await api.createNode(chart.id, {
      ...base,
      relationshipId: relation("child"),
      anchorNodeId: first.id,
      parentNodeId1: first.id,
      parentNodeId2: second.id,
      memo: "子",
    })
  ).nodes[2];
  return { store, api, chart, first, second, child, base };
}
describe("parent references after deletion", () => {
  it.each(["first", "second", "both"] as const)(
    "keeps the child editable after deleting %s parent(s)",
    async (which) => {
      const { api, chart, first, second, child } = await family();
      if (which !== "second") await api.deleteNode(chart.id, first.id);
      if (which !== "first") await api.deleteNode(chart.id, second.id);
      const detail = await api.chart(chart.id),
        result = detail.nodes.find((node) => node.id === child.id)!;
      const parentNodeId1 =
        which === "first" ? second.id : which === "second" ? first.id : null;
      expect(result).toEqual({
        ...child,
        anchorNodeId: which === "second" ? first.id : null,
        parentNodeId1,
        parentNodeId2: null,
      });
      expect(
        detail.edges.some(
          (edge) =>
            !detail.nodes.some((node) => node.id === edge.source) ||
            !detail.nodes.some((node) => node.id === edge.target),
        ),
      ).toBe(false);
      await api.updateNode(chart.id, child.id, { memo: "削除後の編集" });
      const updated = await api.updateNode(chart.id, child.id, {
        x: 360,
        y: 480,
      });
      expect(updated.nodes.find((node) => node.id === child.id)).toMatchObject({
        memo: "削除後の編集",
        x: 360,
        y: 480,
        parentNodeId1,
        parentNodeId2: null,
      });
    },
  );
  it("repairs an old stored parent pair once while preserving timestamps and unknown fields", async () => {
    const { store, api, chart, second, child } = await family();
    const document = (await store.get<ChartDocumentV1>(chartKey(chart.id)))!;
    const timestamp = "2026-01-02T03:04:05.000Z";
    await store.set(chartKey(chart.id), {
      ...document,
      createdAt: timestamp,
      updatedAt: timestamp,
      futureDocumentField: "keep",
      nodes: document.nodes.map((node) =>
        node.id === child.id
          ? { ...node, parentNodeId1: null, futureNodeField: { keep: true } }
          : node,
      ),
    });
    const write = vi.spyOn(store, "set");
    const result = await api.chart(chart.id);
    expect(result.updatedAt).toBe(timestamp);
    expect(result.nodes.find((node) => node.id === child.id)).toMatchObject({
      ...child,
      parentNodeId1: second.id,
      parentNodeId2: null,
    });
    expect(await store.get(chartKey(chart.id))).toMatchObject({
      createdAt: timestamp,
      updatedAt: timestamp,
      futureDocumentField: "keep",
      nodes: expect.arrayContaining([
        expect.objectContaining({
          id: child.id,
          futureNodeField: { keep: true },
        }),
      ]),
    });
    expect(write).toHaveBeenCalledOnce();
    await api.chart(chart.id);
    expect(write).toHaveBeenCalledOnce();
    await api.updateNode(chart.id, child.id, { memo: "修復後" });
  });
  it.each(["merge", "replace"] as const)(
    "normalizes an old v1 backup during %s import",
    async (mode) => {
      const { api, chart, second, child } = await family();
      const backup = (await api.createBackup()).backup;
      const incoming = backup.charts[0];
      incoming.nodes = incoming.nodes.map((node) =>
        node.id === child.id
          ? { ...node, parentNodeId1: null, futureNodeField: "keep" }
          : node,
      );
      const raw = JSON.stringify(backup);
      const parsed = parseBackup(raw);
      expect(parsed.charts[0].updatedAt).toBe(incoming.updatedAt);
      const restored = createLocalApi(createMemoryStore());
      await restored.inspectBackup(raw);
      await restored.importBackup(raw, mode);
      expect(
        (await restored.chart(chart.id)).nodes.find(
          (node) => node.id === child.id,
        ),
      ).toMatchObject({
        parentNodeId1: second.id,
        parentNodeId2: null,
        futureNodeField: "keep",
      });
      await restored.updateNode(chart.id, child.id, {
        memo: "復元後の編集",
        x: 400,
      });
    },
  );
  it("continues to reject parent2-only, duplicate and invalid input references", async () => {
    const { api, chart, second, child, base } = await family();
    for (const input of [
      { parentNodeId1: null, parentNodeId2: second.id },
      { parentNodeId1: second.id, parentNodeId2: second.id },
      { parentNodeId1: "f".repeat(32), parentNodeId2: null },
    ]) {
      await expect(
        api.createNode(chart.id, { ...base, ...input }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      await expect(
        api.updateNode(chart.id, child.id, input),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    }
  });
  it.each(["duplicate", "dangling", "self"])(
    "rejects an invalid %s parent in a backup",
    async (which) => {
      const { api, second, child } = await family();
      const backup = (await api.createBackup()).backup;
      const incoming = backup.charts[0].nodes.find(
        (node) => node.id === child.id,
      )!;
      incoming.parentNodeId1 = which === "duplicate" ? second.id : null;
      incoming.parentNodeId2 =
        which === "dangling"
          ? "f".repeat(32)
          : which === "self"
            ? child.id
            : second.id;
      await expect(
        api.inspectBackup(JSON.stringify(backup)),
      ).rejects.toMatchObject({ code: "BACKUP_INVALID" });
    },
  );
});
