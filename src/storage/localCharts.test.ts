import { describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import { createMemoryStore } from "./kv";
import { createLocalApi } from "./localApi";
import type { ChartDetail } from "../types";

const setup = async () => {
  const api = createLocalApi(createMemoryStore());
  const chart = await api.createChart("テスト相関図");
  const relationships = await api.relationships();
  const genders = await api.genders();
  const kind = (name: string) => {
    const found = relationships.find((item) => item.name === name);
    if (!found) throw new Error(`missing relationship: ${name}`);
    return found.id;
  };
  return { api, chartId: chart.id, relationships, genders, kind };
};

const baseNode = (relationshipId: string, genderId: string) => ({
  relationshipId,
  genderId,
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
  x: 240,
  y: 180,
});

const nodeNamed = (detail: ChartDetail, relationshipId: string) => {
  const found = detail.nodes.find(
    (node) => node.relationshipId === relationshipId,
  );
  if (!found) throw new Error("node not found");
  return found;
};

const expectApiError = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await promise.catch((error: ApiError) => expect(error.code).toBe(code));
};

describe("初期化", () => {
  it("初回利用時に既定の続柄と性別をシードする", async () => {
    const { relationships, genders } = await setup();
    expect(relationships.map((item) => item.name)).toContain("本人");
    expect(relationships.find((item) => item.name === "兄")?.kind).toBe(
      "sibling",
    );
    expect(relationships.find((item) => item.name === "離婚")?.kind).toBe(
      "divorce",
    );
    expect(genders.map((item) => item.name)).toEqual([
      "男性",
      "女性",
      "その他",
    ]);
  });

  it("ストアを共有しない別インスタンスは互いのデータを見ない", async () => {
    const a = createLocalApi(createMemoryStore());
    const b = createLocalApi(createMemoryStore());
    await a.createChart("A のデータ");
    expect(await b.charts()).toEqual([]);
  });
});

describe("エッジ自動生成", () => {
  it("アンカーのないノードにはエッジを作らない", async () => {
    const { api, chartId, genders, kind } = await setup();
    const detail = await api.createNode(
      chartId,
      baseNode(kind("本人"), genders[0].id),
    );
    expect(detail.nodes).toHaveLength(1);
    expect(detail.edges).toHaveLength(0);
  });

  it("kind が self のノードはアンカーがあってもエッジを作らない", async () => {
    const { api, chartId, genders, kind } = await setup();
    const first = await api.createNode(
      chartId,
      baseNode(kind("配偶者"), genders[0].id),
    );
    const detail = await api.createNode(chartId, {
      ...baseNode(kind("本人"), genders[0].id),
      anchorNodeId: first.nodes[0].id,
    });
    expect(detail.edges).toHaveLength(0);
  });

  it("通常の続柄はアンカーを source、自身を target にする", async () => {
    const { api, chartId, genders, kind } = await setup();
    const anchor = await api.createNode(
      chartId,
      baseNode(kind("本人"), genders[0].id),
    );
    const anchorId = anchor.nodes[0].id;
    const detail = await api.createNode(chartId, {
      ...baseNode(kind("子"), genders[0].id),
      anchorNodeId: anchorId,
    });
    const child = nodeNamed(detail, kind("子"));
    expect(detail.edges).toHaveLength(1);
    expect(detail.edges[0].source).toBe(anchorId);
    expect(detail.edges[0].target).toBe(child.id);
  });

  it("kind が parent のときだけ source と target を反転する", async () => {
    const { api, chartId, genders, kind } = await setup();
    const anchor = await api.createNode(
      chartId,
      baseNode(kind("本人"), genders[0].id),
    );
    const anchorId = anchor.nodes[0].id;
    const detail = await api.createNode(chartId, {
      ...baseNode(kind("父"), genders[0].id),
      anchorNodeId: anchorId,
    });
    const father = nodeNamed(detail, kind("父"));
    expect(detail.edges[0].source).toBe(father.id);
    expect(detail.edges[0].target).toBe(anchorId);
  });

  it("アンカーを付け替えると旧エッジを消して1本だけ引き直す", async () => {
    const { api, chartId, genders, kind } = await setup();
    const a = await api.createNode(
      chartId,
      baseNode(kind("本人"), genders[0].id),
    );
    const aId = a.nodes[0].id;
    const b = await api.createNode(
      chartId,
      baseNode(kind("配偶者"), genders[1].id),
    );
    const bId = nodeNamed(b, kind("配偶者")).id;
    const withEdge = await api.createNode(chartId, {
      ...baseNode(kind("子"), genders[0].id),
      anchorNodeId: aId,
    });
    const childId = nodeNamed(withEdge, kind("子")).id;
    expect(withEdge.edges).toHaveLength(1);

    const moved = await api.updateNode(chartId, childId, {
      anchorNodeId: bId,
    });
    expect(moved.edges).toHaveLength(1);
    expect(moved.edges[0].source).toBe(bId);
    expect(moved.edges[0].target).toBe(childId);
  });

  it("エッジの線種と線色は続柄定義の現在値から解決する", async () => {
    const { api, chartId, genders, kind } = await setup();
    const anchor = await api.createNode(
      chartId,
      baseNode(kind("本人"), genders[0].id),
    );
    await api.createNode(chartId, {
      ...baseNode(kind("子"), genders[0].id),
      anchorNodeId: anchor.nodes[0].id,
    });
    await api.updateRelationship(kind("子"), {
      lineStyle: "dashed",
      lineColor: "#123456",
    });
    const detail = await api.chart(chartId);
    expect(detail.edges[0].lineStyle).toBe("dashed");
    expect(detail.edges[0].lineColor).toBe("#123456");
  });
});

describe("ノード削除", () => {
  it("削除したノードのエッジと親参照を落とす", async () => {
    const { api, chartId, genders, kind } = await setup();
    const parent = await api.createNode(
      chartId,
      baseNode(kind("本人"), genders[0].id),
    );
    const parentId = parent.nodes[0].id;
    const withChild = await api.createNode(chartId, {
      ...baseNode(kind("子"), genders[0].id),
      anchorNodeId: parentId,
      parentNodeId1: parentId,
    });
    const childId = nodeNamed(withChild, kind("子")).id;

    const detail = await api.deleteNode(chartId, parentId);
    expect(detail.nodes).toHaveLength(1);
    expect(detail.edges).toHaveLength(0);
    const child = detail.nodes.find((node) => node.id === childId);
    expect(child?.parentNodeId1).toBeNull();
    expect(child?.anchorNodeId).toBeNull();
  });
});

describe("バリデーション", () => {
  it("空のタイトルを拒否する", async () => {
    const { api } = await setup();
    await expectApiError(api.createChart("   "), "VALIDATION_ERROR");
  });

  it("80文字を超えるタイトルを拒否する", async () => {
    const { api } = await setup();
    await expectApiError(api.createChart("あ".repeat(81)), "VALIDATION_ERROR");
  });

  it("フォントサイズの範囲外を拒否する", async () => {
    const { api, chartId, genders, kind } = await setup();
    await expectApiError(
      api.createNode(chartId, {
        ...baseNode(kind("本人"), genders[0].id),
        fontSize: 49,
      }),
      "VALIDATION_ERROR",
    );
  });

  it("ノード倍率の範囲外を拒否する", async () => {
    const { api, chartId, genders, kind } = await setup();
    await expectApiError(
      api.createNode(chartId, {
        ...baseNode(kind("本人"), genders[0].id),
        scale: 2.5,
      }),
      "VALIDATION_ERROR",
    );
  });

  it("有限でない座標を拒否する", async () => {
    const { api, chartId, genders, kind } = await setup();
    await expectApiError(
      api.createNode(chartId, {
        ...baseNode(kind("本人"), genders[0].id),
        x: Number.NaN,
      }),
      "VALIDATION_ERROR",
    );
  });

  it("メモは2000文字で切り詰める", async () => {
    const { api, chartId, genders, kind } = await setup();
    const detail = await api.createNode(chartId, {
      ...baseNode(kind("本人"), genders[0].id),
      memo: "あ".repeat(2500),
    });
    expect([...detail.nodes[0].memo]).toHaveLength(2000);
  });

  it("他の相関図のノードはアンカーにできない", async () => {
    const { api, chartId, genders, kind } = await setup();
    const other = await api.createChart("別の相関図");
    const foreign = await api.createNode(
      other.id,
      baseNode(kind("本人"), genders[0].id),
    );
    await expectApiError(
      api.createNode(chartId, {
        ...baseNode(kind("子"), genders[0].id),
        anchorNodeId: foreign.nodes[0].id,
      }),
      "VALIDATION_ERROR",
    );
  });

  it("自分自身をアンカーにできない", async () => {
    const { api, chartId, genders, kind } = await setup();
    const created = await api.createNode(
      chartId,
      baseNode(kind("本人"), genders[0].id),
    );
    const nodeId = created.nodes[0].id;
    await expectApiError(
      api.updateNode(chartId, nodeId, { anchorNodeId: nodeId }),
      "VALIDATION_ERROR",
    );
  });

  it("親1なしで親2だけの指定を拒否する", async () => {
    const { api, chartId, genders, kind } = await setup();
    const anchor = await api.createNode(
      chartId,
      baseNode(kind("本人"), genders[0].id),
    );
    await expectApiError(
      api.createNode(chartId, {
        ...baseNode(kind("子"), genders[0].id),
        parentNodeId2: anchor.nodes[0].id,
      }),
      "VALIDATION_ERROR",
    );
  });

  it("親1と親2に同じノードを指定できない", async () => {
    const { api, chartId, genders, kind } = await setup();
    const anchor = await api.createNode(
      chartId,
      baseNode(kind("本人"), genders[0].id),
    );
    const anchorId = anchor.nodes[0].id;
    await expectApiError(
      api.createNode(chartId, {
        ...baseNode(kind("子"), genders[0].id),
        parentNodeId1: anchorId,
        parentNodeId2: anchorId,
      }),
      "VALIDATION_ERROR",
    );
  });

  it("存在しない相関図は NOT_FOUND を返す", async () => {
    const { api } = await setup();
    await expectApiError(api.chart("0".repeat(32)), "NOT_FOUND");
  });

  it("レイアウト更新は重複ノードIDを拒否する", async () => {
    const { api, chartId, genders, kind } = await setup();
    const created = await api.createNode(
      chartId,
      baseNode(kind("本人"), genders[0].id),
    );
    const id = created.nodes[0].id;
    await expectApiError(
      api.updateNodeLayout(chartId, [
        { id, x: 0, y: 0, scale: 1 },
        { id, x: 1, y: 1, scale: 1 },
      ]),
      "VALIDATION_ERROR",
    );
  });

  it("レイアウト更新は500件を超えると拒否する", async () => {
    const { api, chartId } = await setup();
    const many = Array.from({ length: 501 }, () => ({
      id: "a".repeat(32),
      x: 0,
      y: 0,
      scale: 1,
    }));
    await expectApiError(
      api.updateNodeLayout(chartId, many),
      "VALIDATION_ERROR",
    );
  });
});

describe("定義の削除制御", () => {
  it("使用中の続柄は削除できない", async () => {
    const { api, chartId, genders, kind } = await setup();
    await api.createNode(chartId, baseNode(kind("本人"), genders[0].id));
    await expectApiError(api.deleteRelationship(kind("本人")), "MASTER_IN_USE");
  });

  it("使用中の性別は削除できない", async () => {
    const { api, chartId, genders, kind } = await setup();
    await api.createNode(chartId, baseNode(kind("本人"), genders[0].id));
    await expectApiError(api.deleteGender(genders[0].id), "MASTER_IN_USE");
  });

  it("未使用の定義は削除できる", async () => {
    const { api, kind } = await setup();
    await api.deleteRelationship(kind("離婚"));
    const remaining = await api.relationships();
    expect(remaining.some((item) => item.name === "離婚")).toBe(false);
  });

  it("不正な色コードを拒否する", async () => {
    const { api } = await setup();
    await expectApiError(
      api.createGender({
        name: "新規",
        shape: "circle",
        fillColor: "red",
        textColor: "#ffffff",
        sortOrder: 0,
        active: true,
      }),
      "VALIDATION_ERROR",
    );
  });

  it("usageCount に全相関図を横断した使用数を返す", async () => {
    const { api, chartId, genders, kind } = await setup();
    const other = await api.createChart("2つめ");
    await api.createNode(chartId, baseNode(kind("本人"), genders[0].id));
    await api.createNode(other.id, baseNode(kind("本人"), genders[0].id));
    const relationships = await api.relationships();
    expect(relationships.find((item) => item.name === "本人")?.usageCount).toBe(
      2,
    );
  });
});

describe("永続化", () => {
  it("同じストアを使えば別インスタンスからでも読み出せる", async () => {
    const store = createMemoryStore();
    const first = createLocalApi(store);
    const chart = await first.createChart("保存テスト");
    const second = createLocalApi(store);
    const detail = await second.chart(chart.id);
    expect(detail.title).toBe("保存テスト");
  });

  it("壊れた保存データは DOCUMENT_CORRUPTED で知らせる", async () => {
    const store = createMemoryStore([["chart:" + "a".repeat(32), { oops: 1 }]]);
    const api = createLocalApi(store);
    await expectApiError(api.chart("a".repeat(32)), "DOCUMENT_CORRUPTED");
  });

  it("新しいスキーマ版の保存データは読まずに拒否する", async () => {
    const id = "b".repeat(32);
    const store = createMemoryStore([
      ["chart:" + id, { schemaVersion: 99, id, title: "未来" }],
    ]);
    const api = createLocalApi(store);
    await expectApiError(api.chart(id), "DOCUMENT_TOO_NEW");
  });

  it("全データ削除後は相関図も定義も初期状態に戻る", async () => {
    const store = createMemoryStore();
    const api = createLocalApi(store);
    await api.createChart("消える相関図");
    await api.clearAllData();
    expect(await api.charts()).toEqual([]);
    expect((await api.relationships()).length).toBeGreaterThan(0);
  });
});

describe("外枠の横幅", () => {
  it("図ごとの横幅と座標をまとめて保存し、旧図の設定は省略できる", async () => {
    const { api, chartId, genders, kind } = await setup();
    const other = await api.createChart("別の図");
    const before = await api.createNode(
      chartId,
      baseNode(kind("本人"), genders[0].id),
    );
    const first = before.nodes[0];
    await api.updateNodeLayout(
      chartId,
      [{ id: first.id, x: 10, y: 20, scale: 1 }],
      1800,
    );
    const saved = await api.chart(chartId);
    expect(saved.frameWidth).toBe(1800);
    expect(saved.nodes[0]).toMatchObject({ x: 10, y: 20 });
    expect((await api.chart(other.id)).frameWidth).toBeUndefined();
    await expect(
      api.updateNodeLayout(chartId, [], 1199),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      api.updateNodeLayout(
        chartId,
        [{ id: "missing", x: 0, y: 0, scale: 1 }],
        1600,
      ),
    ).rejects.toBeInstanceOf(ApiError);
    expect((await api.chart(chartId)).frameWidth).toBe(1800);
  });
});

describe("外枠保存の失敗", () => {
  it("保存失敗時に横幅と人物座標を維持する", async () => {
    const store = createMemoryStore();
    const api = createLocalApi(store);
    const chart = await api.createChart("保存失敗");
    const relationships = await api.relationships();
    const genders = await api.genders();
    const before = await api.createNode(
      chart.id,
      baseNode(relationships[0].id, genders[0].id),
    );
    const first = before.nodes[0];
    const set = store.set;
    store.set = async () => {
      throw new Error("storage unavailable");
    };
    await expect(
      api.updateNodeLayout(
        chart.id,
        [{ id: first.id, x: 0, y: 0, scale: 1 }],
        1800,
      ),
    ).rejects.toThrow("storage unavailable");
    store.set = set;
    const after = await api.chart(chart.id);
    expect(after.frameWidth).toBeUndefined();
    expect(after.nodes).toEqual(before.nodes);
  });
});
