import { isFrameHeight, isFrameWidth } from "../frameSettings";
import { ApiError } from "../api/errors";
import {
  isCohabitationDocument,
  emptyCohabitationDocument,
} from "../cohabitation";
import type { GenderDefinition, RelationshipDefinition } from "../types";
import { chartDocumentCodec, type ChartDocumentV1 } from "./chartDocument";
import { definitionsCodec } from "./defaults";
import { uniqueIds } from "./documentValidation";
import type { DefinitionsDocumentV1 } from "./defaults";
import { createId } from "./ids";
import {
  exceedsCounts,
  exceedsDefinitionCounts,
  exceedsLimits,
  IMPORT_CHARTS_MAX,
} from "./importLimits";
import { normalizeChartParents, parentPairIssue } from "./parentReferences";

export const BACKUP_FORMAT = "kakeizu-studio-backup";
export const BACKUP_VERSION = 1;

/**
 * バックアップファイルの形式。
 *
 * `format` を持たせているのは、他アプリの JSON を読み込んで
 * 意味不明なデータを復元してしまう事故を防ぐため。
 *
 * `edges` はノードの anchor から再導出できるが、あえて含めている。
 * エッジ生成規則が将来変わっても、過去のバックアップを開いたときに
 * 当時の見た目を再現できるようにするため。
 */
export interface BackupChart {
  frameWidth?: number;
  frameHeight?: number;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  nodes: ChartDocumentV1["nodes"];
  edges: ChartDocumentV1["edges"];
  cohabitation: ChartDocumentV1["cohabitation"];
}

export interface BackupFileV1 {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  appVersion: string;
  definitions: {
    relationships: RelationshipDefinition[];
    genders: GenderDefinition[];
  };
  charts: BackupChart[];
}

export type ImportMode = "merge" | "replace";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function buildBackup(
  definitions: DefinitionsDocumentV1,
  charts: readonly ChartDocumentV1[],
  appVersion: string,
): BackupFileV1 {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion,
    definitions: {
      relationships: definitions.relationships,
      genders: definitions.genders,
    },
    // ノードとエッジは保存されている値をそのまま書き出す。
    // 将来フィールドが増えたとき、古いアプリで読み書きしても落ちないようにする。
    charts: charts.map((chart) => ({
      id: chart.id,
      title: chart.title,
      frameWidth: isFrameWidth(chart.frameWidth) ? chart.frameWidth : undefined,
      frameHeight: isFrameHeight(chart.frameHeight)
        ? chart.frameHeight
        : undefined,
      createdAt: chart.createdAt,
      updatedAt: chart.updatedAt,
      nodes: chart.nodes,
      edges: chart.edges,
      cohabitation: chart.cohabitation,
    })),
  };
}

const tooLarge = () =>
  new ApiError(
    422,
    "BACKUP_TOO_LARGE",
    "バックアップファイルの内容が大きすぎるか、値が範囲外です。",
  );

export function parseBackup(raw: string): BackupFileV1 {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ApiError(
      422,
      "BACKUP_INVALID",
      "バックアップファイルを読み込めませんでした。JSON形式のファイルを選んでください。",
    );
  }
  if (!record(value) || value.format !== BACKUP_FORMAT)
    throw new ApiError(
      422,
      "BACKUP_FORMAT_MISMATCH",
      "Kakeizu Studio のバックアップファイルではありません。",
    );
  // 未知の新しいバージョンは部分的に読まず、はっきり拒否する。
  // 黙って一部だけ復元すると、利用者から見えない欠損になるため。
  if (typeof value.version !== "number" || value.version > BACKUP_VERSION)
    throw new ApiError(
      409,
      "BACKUP_TOO_NEW",
      "このファイルは新しいバージョンで作成されています。アプリを更新してから読み込んでください。",
    );
  if (value.version !== BACKUP_VERSION)
    throw new ApiError(
      422,
      "BACKUP_INVALID",
      "バックアップのバージョンが不正です。",
    );
  if (!record(value.definitions) || !Array.isArray(value.charts))
    throw new ApiError(
      422,
      "BACKUP_INVALID",
      "バックアップファイルの内容が壊れています。",
    );
  if (
    value.charts.length > IMPORT_CHARTS_MAX ||
    exceedsDefinitionCounts(value.definitions)
  )
    throw tooLarge();

  const definitions = { ...value.definitions, schemaVersion: 1 };
  const invalid = () =>
    new ApiError(
      422,
      "BACKUP_INVALID",
      "バックアップファイルの内容が壊れています。",
    );
  if (!definitionsCodec.isCurrent(definitions)) throw invalid();
  const relationshipIds = new Set(
    definitions.relationships.map((item) => item.id),
  );
  const genderIds = new Set(definitions.genders.map((item) => item.id));
  const charts = value.charts.map((chart) => {
    if (!record(chart)) throw invalid();
    if (exceedsCounts(chart)) throw tooLarge();
    const document = {
      ...chart,
      schemaVersion: 1,
      createdAt:
        typeof chart.createdAt === "string"
          ? chart.createdAt
          : new Date().toISOString(),
      updatedAt:
        typeof chart.updatedAt === "string"
          ? chart.updatedAt
          : new Date().toISOString(),
      cohabitation:
        chart.cohabitation === undefined
          ? emptyCohabitationDocument()
          : chart.cohabitation,
    };
    if (!chartDocumentCodec.isCurrent(document)) throw invalid();
    if (exceedsLimits(document)) throw tooLarge();
    const nodeIds = new Set(document.nodes.map((node) => node.id));
    const validRef = (id: string | null, ownId: string) =>
      id === null || (id !== ownId && nodeIds.has(id));
    if (
      document.nodes.some(
        (node) =>
          !relationshipIds.has(node.relationshipId) ||
          !genderIds.has(node.genderId) ||
          !validRef(node.anchorNodeId, node.id) ||
          !validRef(node.parentNodeId1, node.id) ||
          !validRef(node.parentNodeId2, node.id),
      )
    )
      throw invalid();
    if (
      document.edges.some(
        (edge) =>
          !nodeIds.has(edge.source) ||
          !nodeIds.has(edge.target) ||
          !relationshipIds.has(edge.relationshipId),
      )
    )
      throw invalid();
    const cohabitation = document.cohabitation;
    if (
      !uniqueIds([...cohabitation.cohabitations, ...cohabitation.labels]) ||
      cohabitation.cohabitations.some((group) =>
        group.nodeIds.some((id) => !nodeIds.has(id)),
      )
    )
      throw invalid();
    const normalized = normalizeChartParents(document);
    if (
      normalized.nodes.some(
        (node) =>
          parentPairIssue(node.parentNodeId1, node.parentNodeId2) !== null,
      )
    )
      throw invalid();
    return normalized satisfies BackupChart;
  });
  if (!uniqueIds(charts)) throw invalid();

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : "",
    appVersion: typeof value.appVersion === "string" ? value.appVersion : "",
    definitions: {
      relationships: definitions.relationships,
      genders: definitions.genders,
    },
    charts,
  };
}

/** バックアップ中の1件を保存ドキュメントへ戻す。未知フィールドは保持する。 */
export function toChartDocument(
  chart: BackupChart,
  id = chart.id,
): ChartDocumentV1 {
  return {
    schemaVersion: 1,
    legacyCohabitationMigrated: true,
    id,
    title: chart.title,
    frameWidth: isFrameWidth(chart.frameWidth) ? chart.frameWidth : undefined,
    frameHeight: isFrameHeight(chart.frameHeight)
      ? chart.frameHeight
      : undefined,
    createdAt: chart.createdAt,
    updatedAt: chart.updatedAt,
    nodes: chart.nodes,
    edges: chart.edges,
    cohabitation: isCohabitationDocument(chart.cohabitation)
      ? chart.cohabitation
      : emptyCohabitationDocument(),
  };
}

/**
 * 追加インポート時の ID 衝突を避ける。
 * 相関図ごとに保存が独立しているため、付け替えるのは相関図の ID だけでよい
 * (同じノード ID が別の相関図に存在しても干渉しない)。
 */
export const resolveChartId = (chart: BackupChart, taken: Set<string>) =>
  taken.has(chart.id) ? createId() : chart.id;

/**
 * 追加インポートでは利用者の現在の表示設定を壊さない。
 * ただし復元したノードが参照する定義が無いと描画できないため、
 * 手元に存在しない ID の定義だけを補う。
 */
export function mergeDefinitions(
  current: DefinitionsDocumentV1,
  incoming: BackupFileV1["definitions"],
): DefinitionsDocumentV1 {
  const knownRelationships = new Set(
    current.relationships.map((item) => item.id),
  );
  const knownGenders = new Set(current.genders.map((item) => item.id));
  return {
    ...current,
    relationships: [
      ...current.relationships,
      ...incoming.relationships.filter(
        (item) => item?.id && !knownRelationships.has(item.id),
      ),
    ],
    genders: [
      ...current.genders,
      ...incoming.genders.filter(
        (item) => item?.id && !knownGenders.has(item.id),
      ),
    ],
  };
}

export const backupFileName = (now = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `kakeizu-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
};

export const chartBackupFileName = (title: string, now = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  const safeTitle =
    title
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "chart";
  return `kakeizu-${safeTitle}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
};
