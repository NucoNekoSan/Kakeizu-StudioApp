export const COHABITATION_DOCUMENT_VERSION = 1 as const;

export interface Cohabitation {
  id: string;
  nodeIds: string[];
  label: string;
  fontSize: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  labelX?: number;
  labelY?: number;
}

export interface CohabitationLabel {
  id: string;
  x: number;
  y: number;
  fontSize: number;
}

export interface CohabitationDocumentV1 {
  version: typeof COHABITATION_DOCUMENT_VERSION;
  cohabitations: Cohabitation[];
  labels: CohabitationLabel[];
}

export type CohabitationDocument = CohabitationDocumentV1;

export const emptyCohabitationDocument = (): CohabitationDocument => ({
  version: COHABITATION_DOCUMENT_VERSION,
  cohabitations: [],
  labels: [],
});

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function isCohabitation(value: unknown): value is Cohabitation {
  if (!record(value)) return false;
  return (
    text(value.id) &&
    value.id.length > 0 &&
    Array.isArray(value.nodeIds) &&
    value.nodeIds.length >= 1 &&
    value.nodeIds.every(text) &&
    new Set(value.nodeIds).size === value.nodeIds.length &&
    text(value.label) &&
    finite(value.fontSize) &&
    value.fontSize >= 8 &&
    value.fontSize <= 48 &&
    finite(value.cx) &&
    finite(value.cy) &&
    finite(value.rx) &&
    finite(value.ry) &&
    value.rx >= 30 &&
    value.ry >= 30 &&
    (value.labelX === undefined || finite(value.labelX)) &&
    (value.labelY === undefined || finite(value.labelY))
  );
}

export function isCohabitationLabel(
  value: unknown,
): value is CohabitationLabel {
  return (
    record(value) &&
    text(value.id) &&
    value.id.length > 0 &&
    finite(value.x) &&
    finite(value.y) &&
    finite(value.fontSize) &&
    value.fontSize >= 8 &&
    value.fontSize <= 48
  );
}

export function isCohabitationDocument(
  value: unknown,
): value is CohabitationDocument {
  return (
    record(value) &&
    value.version === COHABITATION_DOCUMENT_VERSION &&
    Array.isArray(value.cohabitations) &&
    value.cohabitations.every(isCohabitation) &&
    Array.isArray(value.labels) &&
    value.labels.every(isCohabitationLabel) &&
    new Set([...value.cohabitations, ...value.labels].map((item) => item.id))
      .size ===
      value.cohabitations.length + value.labels.length
  );
}

export function parseCohabitationDocument(
  value: unknown,
): CohabitationDocument | null {
  return isCohabitationDocument(value) ? value : null;
}
