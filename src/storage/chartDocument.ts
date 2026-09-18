import {
  emptyCohabitationDocument,
  isCohabitationDocument,
  type CohabitationDocument,
} from "../features/editor/cohabitationModel";
import type {
  ChartDetail,
  ChartEdgeRecord,
  ChartNodeRecord,
  GenderDefinition,
  RelationshipDefinition,
} from "../types";
import { isFrameHeight, isFrameWidth } from "../frameSettings";
import { createId, isId, nowIso } from "./ids";
import type { DocumentCodec } from "./versioned";

export const CHART_SCHEMA_VERSION = 1;

/**
 * 保存されるエッジ。`ChartEdgeRecord` と違い線種・線色を持たない。
 * 表示用の値は読み出し時に続柄定義から解決する
 * (PHP 版 `chartDetail()` が chart_edges と relationship_definitions を
 *  JOIN していたのと同じ。定義を編集したとき既存エッジにも反映させるため)。
 */
export interface StoredEdge {
  id: string;
  source: string;
  target: string;
  relationshipId: string;
}

export interface ChartDocumentV1 {
  frameWidth?: number;
  frameHeight?: number;
  schemaVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  nodes: ChartNodeRecord[];
  edges: StoredEdge[];
  cohabitation: CohabitationDocument;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStoredEdge = (value: unknown): value is StoredEdge =>
  record(value) &&
  isId(value.id) &&
  isId(value.source) &&
  isId(value.target) &&
  isId(value.relationshipId);

const isNodeRecord = (value: unknown): value is ChartNodeRecord =>
  record(value) &&
  isId(value.id) &&
  isId(value.relationshipId) &&
  isId(value.genderId) &&
  typeof value.memo === "string" &&
  Number.isFinite(value.fontSize) &&
  Number.isFinite(value.relationshipFontSize) &&
  Number.isFinite(value.scale) &&
  Number.isFinite(value.x) &&
  Number.isFinite(value.y);

export const chartDocumentCodec: DocumentCodec<ChartDocumentV1> = {
  currentVersion: CHART_SCHEMA_VERSION,
  isCurrent(value): value is ChartDocumentV1 {
    return (
      record(value) &&
      value.schemaVersion === CHART_SCHEMA_VERSION &&
      isId(value.id) &&
      typeof value.title === "string" &&
      (value.frameWidth === undefined || isFrameWidth(value.frameWidth)) &&
      (value.frameHeight === undefined || isFrameHeight(value.frameHeight)) &&
      Array.isArray(value.nodes) &&
      value.nodes.every(isNodeRecord) &&
      Array.isArray(value.edges) &&
      value.edges.every(isStoredEdge) &&
      isCohabitationDocument(value.cohabitation)
    );
  },
  empty(): ChartDocumentV1 {
    const timestamp = nowIso();
    return {
      schemaVersion: CHART_SCHEMA_VERSION,
      id: createId(),
      title: "",
      createdAt: timestamp,
      updatedAt: timestamp,
      nodes: [],
      edges: [],
      cohabitation: emptyCohabitationDocument(),
    };
  },
};

export function createChartDocument(
  title: string,
  id = createId(),
): ChartDocumentV1 {
  return { ...chartDocumentCodec.empty(), id, title };
}

/**
 * アンカーからエッジを1本導出する。
 * `server/src/routes/charts.php` の分岐をそのまま移植:
 *   - `self` はエッジを作らない
 *   - `parent` のときだけ source/target を反転する
 */
export function deriveEdge(
  nodeId: string,
  anchorNodeId: string | null,
  relationship: Pick<RelationshipDefinition, "id" | "kind">,
): StoredEdge | null {
  if (!anchorNodeId || relationship.kind === "self") return null;
  const reversed = relationship.kind === "parent";
  return {
    id: createId(),
    source: reversed ? nodeId : anchorNodeId,
    target: reversed ? anchorNodeId : nodeId,
    relationshipId: relationship.id,
  };
}

/** ノードと旧アンカーの間の既存エッジを取り除く (PATCH 時の再生成前処理)。 */
export const withoutEdgeBetween = (
  edges: readonly StoredEdge[],
  nodeId: string,
  anchorNodeId: string | null,
): StoredEdge[] =>
  anchorNodeId
    ? edges.filter(
        (edge) =>
          !(
            (edge.source === nodeId && edge.target === anchorNodeId) ||
            (edge.source === anchorNodeId && edge.target === nodeId)
          ),
      )
    : [...edges];

/** ノード削除時: そのノードに触れるエッジと、親参照を落とす。 */
export function removeNode(
  document: ChartDocumentV1,
  nodeId: string,
): ChartDocumentV1 {
  return {
    ...document,
    nodes: document.nodes
      .filter((node) => node.id !== nodeId)
      .map((node) => ({
        ...node,
        anchorNodeId: node.anchorNodeId === nodeId ? null : node.anchorNodeId,
        parentNodeId1:
          node.parentNodeId1 === nodeId ? null : node.parentNodeId1,
        parentNodeId2:
          node.parentNodeId2 === nodeId ? null : node.parentNodeId2,
      })),
    edges: document.edges.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId,
    ),
    cohabitation: {
      ...document.cohabitation,
      cohabitations: document.cohabitation.cohabitations
        .map((group) => ({
          ...group,
          nodeIds: group.nodeIds.filter((id) => id !== nodeId),
        }))
        .filter((group) => group.nodeIds.length >= 2),
    },
  };
}

/**
 * 保存ドキュメント + 定義から UI が受け取る `ChartDetail` を組み立てる。
 * PHP 版 `chartDetail()` と同じ形を返すことで UI 側を無改修に保つ。
 */
export function toChartDetail(
  document: ChartDocumentV1,
  relationships: RelationshipDefinition[],
  genders: GenderDefinition[],
): ChartDetail {
  const byId = new Map(relationships.map((item) => [item.id, item]));
  const edges: ChartEdgeRecord[] = document.edges.flatMap((edge) => {
    const relationship = byId.get(edge.relationshipId);
    if (!relationship) return [];
    return [
      {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        relationshipId: edge.relationshipId,
        relationKind: relationship.kind,
        lineStyle: relationship.lineStyle,
        lineColor: relationship.lineColor,
      },
    ];
  });
  return {
    id: document.id,
    title: document.title,
    frameWidth: document.frameWidth,
    frameHeight: document.frameHeight,
    nodes: document.nodes,
    edges,
    relationships,
    genders,
    updatedAt: document.updatedAt,
  };
}
