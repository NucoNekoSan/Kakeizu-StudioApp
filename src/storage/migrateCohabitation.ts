import {
  emptyCohabitationDocument,
  isCohabitationDocument,
} from "../cohabitation";
import { ApiError } from "../api/errors";
import type { ChartDocumentV1 } from "./chartDocument";

export type LegacyStorage = Pick<Storage, "getItem" | "removeItem">;

/** Migrate only the requested chart; recovery operations never call this. */
export async function migrateCohabitation(
  chart: ChartDocumentV1,
  storage: LegacyStorage,
  save: (document: ChartDocumentV1) => Promise<void>,
): Promise<ChartDocumentV1> {
  if (chart.legacyCohabitationMigrated) return chart;
  const id = chart.id;
  const keys = [
    `kakeizu:cohabitation-draft:v1:${id}`,
    `kakeizu:cohabitations:${id}`,
    `kakeizu:cohabitation-labels:${id}`,
  ];
  try {
    const values = keys.map((key) => storage.getItem(key));
    if (values.every((value) => value === null)) {
      const migrated: ChartDocumentV1 = {
        ...chart,
        legacyCohabitationMigrated: true,
      };
      await save(migrated);
      return migrated;
    }
    const document: unknown =
      values[0] !== null
        ? JSON.parse(values[0])
        : {
            ...emptyCohabitationDocument(),
            cohabitations: JSON.parse(values[1] ?? "[]"),
            labels: JSON.parse(values[2] ?? "[]"),
          };
    if (!isCohabitationDocument(document)) throw new Error("invalid document");
    const validIds = new Set(chart.nodes.map((node) => node.id));
    const cohabitation = {
      ...document,
      cohabitations: document.cohabitations.flatMap((group) => {
        const nodeIds = group.nodeIds.filter((nodeId) => validIds.has(nodeId));
        return nodeIds.length ? [{ ...group, nodeIds }] : [];
      }),
    };
    const migrated: ChartDocumentV1 = {
      ...chart,
      cohabitation,
      legacyCohabitationMigrated: true,
    };
    await save(migrated);
    // Once committed, cleanup failure must not replay stale data next time.
    for (const key of keys) {
      try {
        storage.removeItem(key);
      } catch {
        /* optional cleanup */
      }
    }
    return migrated;
  } catch {
    throw new ApiError(
      422,
      "COHABITATION_MIGRATION_FAILED",
      "同居情報を移行できませんでした。元のデータは削除していません。ブラウザの保存設定を確認してください。",
    );
  }
}
