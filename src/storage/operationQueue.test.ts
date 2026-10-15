import { expect, it } from "vitest";
import { createLocalApi } from "./localApi";
import { createMemoryStore, type DocumentStore } from "./kv";

it("独立したストア参照でも操作全体を共有ロック内で実行し、両方の追加を保持する", async () => {
  const underlying = createMemoryStore();
  let tail: Promise<unknown> = Promise.resolve();
  const runExclusive: NonNullable<DocumentStore["runExclusive"]> = (run) => {
    const result = tail.then(run);
    tail = result.catch(() => undefined);
    return result;
  };
  const a = createLocalApi({ ...underlying, runExclusive });
  const b = createLocalApi({ ...underlying, runExclusive });
  const chart = await a.createChart("同時編集");
  const relationshipId = (await a.relationships())[0].id;
  const genderId = (await a.genders())[0].id;
  const node = (memo: string) => ({
    relationshipId,
    genderId,
    memo,
    anchorNodeId: null,
    parentNodeId1: null,
    parentNodeId2: null,
    placementDirection: null,
    connectionDirection: null,
    divorced: false,
    fontSize: 16,
    relationshipFontSize: 17,
    scale: 1,
    x: 0,
    y: 0,
  });
  await Promise.all([
    a.createNode(chart.id, node("タブA")),
    b.createNode(chart.id, node("タブB")),
  ]);
  expect((await a.chart(chart.id)).nodes.map((n) => n.memo).sort()).toEqual([
    "タブA",
    "タブB",
  ]);
  await Promise.all([
    a.updateChart(chart.id, "新しいタイトル"),
    b.createNode(chart.id, node("タブC")),
  ]);
  const final = await a.chart(chart.id);
  expect(final.title).toBe("新しいタイトル");
  expect(final.nodes).toHaveLength(3);
  await expect(a.updateChart("missing", "拒否する要求")).rejects.toBeDefined();
  await expect(b.createChart("失敗後も継続")).resolves.toMatchObject({
    title: "失敗後も継続",
  });
});
