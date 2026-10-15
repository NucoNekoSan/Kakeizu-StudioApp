import type { ChartDocumentV1 } from "./chartDocument";
import { MEMO_MAX, TITLE_MAX } from "./validation";

/**
 * バックアップ取り込みの上限。
 *
 * ファイルは利用者の管理外から来るため、アプリが自分で作る値より広く、
 * しかし描画や保存が破綻しない範囲で止める。正規の書き出しは
 * アプリ自身の入力制限 (TITLE_MAX・MEMO_MAX) を満たすので、
 * UTF-16 のコードユニット数で数えても通常の利用では届かない。
 */
export const BACKUP_MAX_BYTES = 50 * 1024 * 1024;
export const IMPORT_CHARTS_MAX = 1000;
export const IMPORT_NODES_MAX = 5000;
export const IMPORT_COHABITATIONS_MAX = 5000;
export const IMPORT_TITLE_MAX = TITLE_MAX * 2;
export const IMPORT_MEMO_MAX = MEMO_MAX * 2;
export const IMPORT_LABEL_MAX = 200;
export const IMPORT_ID_MAX = 64;
/** 座標・半径の絶対値の上限。通常の家系図は数千の範囲に収まる。 */
export const IMPORT_COORD_MAX = 1_000_000;

const inRange = (value: number | undefined) =>
  value === undefined || Math.abs(value) <= IMPORT_COORD_MAX;

export const IMPORT_DEFINITIONS_MAX = 500;

export function exceedsDefinitionCounts(
  definitions: Record<string, unknown>,
): boolean {
  const length = (value: unknown) => (Array.isArray(value) ? value.length : 0);
  return (
    length(definitions.relationships) > IMPORT_DEFINITIONS_MAX ||
    length(definitions.genders) > IMPORT_DEFINITIONS_MAX
  );
}

/** 件数だけの安価な検査。型検査より前に呼び、巨大な配列を走査する前に止める。 */
export function exceedsCounts(chart: Record<string, unknown>): boolean {
  const length = (value: unknown) => (Array.isArray(value) ? value.length : 0);
  const cohabitation = chart.cohabitation as
    { cohabitations?: unknown; labels?: unknown } | null | undefined;
  return (
    length(chart.nodes) > IMPORT_NODES_MAX ||
    length(chart.edges) > IMPORT_NODES_MAX * 2 ||
    length(cohabitation?.cohabitations) + length(cohabitation?.labels) >
      IMPORT_COHABITATIONS_MAX
  );
}

/** 型検査を通ったあとの長さ・値域の検査。 */
export function exceedsLimits(chart: ChartDocumentV1): boolean {
  if (chart.title.length > IMPORT_TITLE_MAX) return true;
  if (
    chart.nodes.some(
      (node) =>
        node.memo.length > IMPORT_MEMO_MAX ||
        !inRange(node.x) ||
        !inRange(node.y),
    )
  )
    return true;
  const { cohabitations, labels } = chart.cohabitation;
  return (
    cohabitations.some(
      (group) =>
        group.id.length > IMPORT_ID_MAX ||
        group.label.length > IMPORT_LABEL_MAX ||
        group.nodeIds.length > IMPORT_NODES_MAX ||
        !inRange(group.cx) ||
        !inRange(group.cy) ||
        !inRange(group.rx) ||
        !inRange(group.ry) ||
        !inRange(group.labelX) ||
        !inRange(group.labelY),
    ) ||
    labels.some(
      (label) =>
        label.id.length > IMPORT_ID_MAX ||
        !inRange(label.x) ||
        !inRange(label.y),
    )
  );
}
