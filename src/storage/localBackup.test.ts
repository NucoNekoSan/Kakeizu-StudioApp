import { describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import { BACKUP_FORMAT, backupFileName } from "./backupModel";
import { createMemoryStore, type DocumentStore } from "./kv";
import { createLocalApi } from "./localApi";

const seedChart = async (
  api: ReturnType<typeof createLocalApi>,
  title: string,
) => {
  const chart = await api.createChart(title);
  const relationships = await api.relationships();
  const genders = await api.genders();
  const self = relationships.find((item) => item.name === "本人")!;
  const child = relationships.find((item) => item.name === "子")!;
  const base = {
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
    x: 240,
    y: 180,
  };
  const first = await api.createNode(chart.id, {
    ...base,
    relationshipId: self.id,
  });
  await api.createNode(chart.id, {
    ...base,
    relationshipId: child.id,
    anchorNodeId: first.nodes[0].id,
    memo: "長女",
  });
  return chart.id;
};

const setup = async (store: DocumentStore = createMemoryStore()) => {
  const api = createLocalApi(store);
  const chartId = await seedChart(api, "家族A");
  return { api, store, chartId };
};

const expectApiError = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await promise.catch((error: ApiError) => expect(error.code).toBe(code));
};

describe("エクスポート", () => {
  it("書き出したファイルに識別子とバージョンを含める", async () => {
    const { api } = await setup();
    const { backup } = await api.createBackup();
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(1);
    expect(backup.charts).toHaveLength(1);
    expect(backup.definitions.relationships.length).toBeGreaterThan(0);
  });

  it("ファイル名に日時を含める", () => {
    expect(backupFileName(new Date(2026, 8, 14, 7, 5))).toBe(
      "kakeizu-backup-20260914-0705.json",
    );
  });

  it("指定した相関図だけを読み込み互換の形式で書き出す", async () => {
    const { api, chartId } = await setup();
    await seedChart(api, "家族B");
    const { backup, json, fileName } = await api.createChartBackup(chartId);

    expect(backup.charts).toHaveLength(1);
    expect(backup.charts[0].id).toBe(chartId);
    expect(backup.definitions.relationships.length).toBeGreaterThan(0);
    expect(fileName).toMatch(/^kakeizu-家族A-\d{8}-\d{4}\.json$/);

    const restored = createLocalApi(createMemoryStore());
    const result = await restored.importBackup(json, "merge");
    expect(result.importedCharts).toBe(1);
    expect((await restored.charts()).map((chart) => chart.title)).toEqual([
      "家族A",
    ]);
  });

  it("エクスポート前は未実施として扱う", async () => {
    const { api } = await setup();
    const status = await api.backupStatus();
    expect(status.lastExportedAt).toBeNull();
    expect(status.daysSinceExport).toBeNull();
    expect(status.chartCount).toBe(1);
  });

  it("保存完了を記録すると経過日数を返す", async () => {
    const { api } = await setup();
    await api.markExported();
    const status = await api.backupStatus();
    expect(status.lastExportedAt).not.toBeNull();
    expect(status.daysSinceExport).toBe(0);
  });
});

describe("往復", () => {
  it("置き換えインポートで元の状態を完全に復元する", async () => {
    const { api, chartId } = await setup();
    const before = await api.chart(chartId);
    const { json } = await api.createBackup();

    const restoredApi = createLocalApi(createMemoryStore());
    const result = await restoredApi.importBackup(json, "replace");
    expect(result.importedCharts).toBe(1);

    const after = await restoredApi.chart(chartId);
    expect(after.title).toBe(before.title);
    expect(after.nodes).toEqual(before.nodes);
    expect(after.edges).toEqual(before.edges);
    expect(after.relationships).toEqual(before.relationships);
    expect(after.genders).toEqual(before.genders);
  });

  it("置き換えインポートは既存データを残さない", async () => {
    const { api } = await setup();
    const { json } = await api.createBackup();

    const other = createLocalApi(createMemoryStore());
    await seedChart(other, "消えるはずの相関図");
    await other.importBackup(json, "replace");

    const charts = await other.charts();
    expect(charts.map((chart) => chart.title)).toEqual(["家族A"]);
  });
});

describe("追加インポート", () => {
  it("ID が衝突しなければそのまま取り込む", async () => {
    const { api } = await setup();
    const { json } = await api.createBackup();

    const other = createLocalApi(createMemoryStore());
    await seedChart(other, "既存の相関図");
    const result = await other.importBackup(json, "merge");

    expect(result.importedCharts).toBe(1);
    expect(result.renamedCharts).toBe(0);
    const titles = (await other.charts()).map((chart) => chart.title);
    expect(titles).toContain("既存の相関図");
    expect(titles).toContain("家族A");
  });

  it("同じファイルを二重に取り込んでも既存を壊さず複製する", async () => {
    const { api, chartId } = await setup();
    const { json } = await api.createBackup();

    const result = await api.importBackup(json, "merge");
    expect(result.renamedCharts).toBe(1);

    const charts = await api.charts();
    expect(charts).toHaveLength(2);
    expect(charts.every((chart) => chart.title === "家族A")).toBe(true);
    // 元の相関図は ID も内容も保たれている
    expect((await api.chart(chartId)).nodes).toHaveLength(2);
  });

  it("手元に無い続柄だけを補い、既存の表示設定は変えない", async () => {
    const { api } = await setup();
    const custom = await api.createRelationship({
      name: "恩師",
      kind: "other",
      direction: "right",
      lineStyle: "dotted",
      lineColor: "#123456",
      sortOrder: 99,
      active: true,
    });
    const { json } = await api.createBackup();

    const incoming = await api.relationships();
    const other = createLocalApi(createMemoryStore());
    const before = await other.relationships();
    await other.importBackup(json, "merge");
    const after = await other.relationships();

    // 取り込み先の既定定義は別インスタンスなので ID が異なる。
    // 手元に無い ID がすべて補われ、既存はそのまま残る。
    expect(after).toHaveLength(before.length + incoming.length);
    expect(after.find((item) => item.id === custom.id)?.name).toBe("恩師");
    // 既存の定義は書き換わっていない
    for (const item of before)
      expect(after.find((entry) => entry.id === item.id)).toEqual(item);
  });

  it("取り込んだノードが参照する続柄を解決できる", async () => {
    const { api } = await setup();
    const { json } = await api.createBackup();

    const other = createLocalApi(createMemoryStore());
    await other.importBackup(json, "merge");
    const charts = await other.charts();
    const detail = await other.chart(charts[0].id);

    // 定義が補われていればエッジの線種・線色が解決できている
    expect(detail.edges).toHaveLength(1);
    expect(detail.edges[0].lineColor).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("不正なファイルの拒否", () => {
  it("JSON でないファイルを拒否する", async () => {
    const { api } = await setup();
    await expectApiError(
      api.importBackup("これはJSONではない"),
      "BACKUP_INVALID",
    );
  });

  it("他アプリの JSON を拒否する", async () => {
    const { api } = await setup();
    await expectApiError(
      api.importBackup(JSON.stringify({ version: 1, charts: [] })),
      "BACKUP_FORMAT_MISMATCH",
    );
  });

  it("新しいバージョンのファイルは読まずに拒否する", async () => {
    const { api } = await setup();
    await expectApiError(
      api.importBackup(
        JSON.stringify({
          format: BACKUP_FORMAT,
          version: 2,
          definitions: { relationships: [], genders: [] },
          charts: [],
        }),
      ),
      "BACKUP_TOO_NEW",
    );
  });

  it("相関図の形が壊れているファイルを拒否する", async () => {
    const { api } = await setup();
    await expectApiError(
      api.importBackup(
        JSON.stringify({
          format: BACKUP_FORMAT,
          version: 1,
          definitions: { relationships: [], genders: [] },
          charts: [{ id: "short", title: "壊れている" }],
        }),
      ),
      "BACKUP_INVALID",
    );
  });

  it("拒否されたときは既存データを変更しない", async () => {
    const { api, chartId } = await setup();
    await expectApiError(api.importBackup("壊れたファイル"), "BACKUP_INVALID");
    const detail = await api.chart(chartId);
    expect(detail.nodes).toHaveLength(2);
  });
});

describe("前方互換", () => {
  it("将来フィールドが増えても取り込みで落とさない", async () => {
    const { api, store, chartId } = await setup();
    // 将来のアプリが書き込んだ想定の未知フィールドを混ぜる
    const stored = await store.get<Record<string, unknown>>(`chart:${chartId}`);
    const nodes = (stored!.nodes as Record<string, unknown>[]).map((node) => ({
      ...node,
      futureField: "保持されるべき値",
    }));
    await store.set(`chart:${chartId}`, { ...stored, nodes });

    const { json } = await api.createBackup();
    expect(json).toContain("futureField");

    const other = createLocalApi(createMemoryStore());
    await other.importBackup(json, "replace");
    const restored = await other.chart(chartId);
    expect(
      (restored.nodes[0] as unknown as Record<string, unknown>).futureField,
    ).toBe("保持されるべき値");
  });

  it("取り込み前にファイルの中身を確認できる", async () => {
    const { api } = await setup();
    const { json } = await api.createBackup();
    const summary = await api.inspectBackup(json);
    expect(summary.chartCount).toBe(1);
    expect(summary.titles).toEqual(["家族A"]);
  });
});

describe("外枠設定のバックアップ", () => {
  it("図ごとの横幅と縦幅を復元する", async () => {
    const { api, chartId } = await setup();
    await api.updateNodeLayout(chartId, [], 3200, 1800);
    const backup = await api.createBackup();
    const restored = createLocalApi(createMemoryStore());
    await restored.importBackup(backup.json, "replace");
    expect((await restored.chart(chartId)).frameWidth).toBe(3200);
    expect((await restored.chart(chartId)).frameHeight).toBe(1800);
  });
});
