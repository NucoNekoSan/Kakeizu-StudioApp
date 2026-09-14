import type {
  Direction,
  GenderDefinition,
  LineStyle,
  RelationKind,
  RelationshipDefinition,
  Shape,
} from "../types";
import { createId } from "./ids";
import type { DocumentCodec } from "./versioned";

export const DEFINITIONS_SCHEMA_VERSION = 1;

export interface DefinitionsDocumentV1 {
  schemaVersion: 1;
  relationships: RelationshipDefinition[];
  genders: GenderDefinition[];
}

/**
 * `Kakeizu\App::seed()` の既定値の移植。
 * サーバー版では kind と diagram_role に分解して保存していたが、
 * `RelationKind` は既に sibling / divorce を含む公開形なのでそのまま持つ。
 */
const RELATIONSHIP_SEED: ReadonlyArray<
  readonly [string, RelationKind, Direction, LineStyle, string]
> = [
  ["本人", "self", "below", "solid", "#52645e"],
  ["父", "parent", "above", "solid", "#52645e"],
  ["母", "parent", "above", "solid", "#52645e"],
  ["兄", "sibling", "left", "solid", "#52645e"],
  ["姉", "sibling", "left", "solid", "#52645e"],
  ["弟", "sibling", "right", "solid", "#52645e"],
  ["妹", "sibling", "right", "solid", "#52645e"],
  ["配偶者", "partner", "right", "solid", "#9b7440"],
  ["子", "child", "below", "solid", "#52645e"],
  ["離婚", "divorce", "right", "solid", "#9b7440"],
];

const GENDER_SEED: ReadonlyArray<readonly [string, Shape, string, string]> = [
  ["男性", "square", "#6f94a6", "#ffffff"],
  ["女性", "circle", "#d8785b", "#ffffff"],
  ["その他", "diamond", "#c99b54", "#ffffff"],
];

export function seedDefinitions(): DefinitionsDocumentV1 {
  return {
    schemaVersion: DEFINITIONS_SCHEMA_VERSION,
    relationships: RELATIONSHIP_SEED.map(
      ([name, kind, direction, lineStyle, lineColor], index) => ({
        id: createId(),
        name,
        kind,
        direction,
        lineStyle,
        lineColor,
        sortOrder: index,
        active: true,
      }),
    ),
    genders: GENDER_SEED.map(([name, shape, fillColor, textColor], index) => ({
      id: createId(),
      name,
      shape,
      fillColor,
      textColor,
      sortOrder: index,
      active: true,
    })),
  };
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const definitionsCodec: DocumentCodec<DefinitionsDocumentV1> = {
  currentVersion: DEFINITIONS_SCHEMA_VERSION,
  isCurrent(value): value is DefinitionsDocumentV1 {
    return (
      record(value) &&
      value.schemaVersion === DEFINITIONS_SCHEMA_VERSION &&
      Array.isArray(value.relationships) &&
      Array.isArray(value.genders)
    );
  },
  empty: seedDefinitions,
};
