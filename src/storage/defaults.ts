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
 * 既定の続柄。`Kakeizu\App::seed()` の10件を基礎に、家族相関図（ジェノグラム）の
 * 作成で実際に必要になる続柄を加えている。
 *
 * 線種は意味を持たせている:
 *   solid  … 血縁・法律上の関係
 *   dashed … 姻族・養子縁組・事実上の関係（非血縁）
 *   dotted … 社会的関係、および予定の関係（婚約）
 *
 * 線色:
 *   #52645e … 血縁
 *   #9b7440 … 配偶者・パートナー関係
 *   #7b8a94 … 社会的関係（里親子・同居人・支援者）
 *
 * `active: false` の続柄は選択肢に出さず、設定画面で有効化すると使える。
 * 使用頻度の低いものを既定で隠し、選択肢が長くなりすぎないようにするため。
 */
const BLOOD = "#52645e";
const PARTNER = "#9b7440";
const SOCIAL = "#7b8a94";

type RelationshipSeed = readonly [
  name: string,
  kind: RelationKind,
  direction: Direction,
  lineStyle: LineStyle,
  lineColor: string,
  active?: boolean,
];

const RELATIONSHIP_SEED: readonly RelationshipSeed[] = [
  // 基準
  ["本人", "self", "below", "solid", BLOOD],

  // 直系尊属
  ["父", "parent", "above", "solid", BLOOD],
  ["母", "parent", "above", "solid", BLOOD],
  ["祖父", "parent", "above", "solid", BLOOD],
  ["祖母", "parent", "above", "solid", BLOOD],
  ["曽祖父", "parent", "above", "solid", BLOOD, false],
  ["曽祖母", "parent", "above", "solid", BLOOD, false],

  // 兄弟姉妹
  ["兄", "sibling", "left", "solid", BLOOD],
  ["姉", "sibling", "left", "solid", BLOOD],
  ["弟", "sibling", "right", "solid", BLOOD],
  ["妹", "sibling", "right", "solid", BLOOD],

  // 配偶者・パートナー関係
  ["配偶者", "partner", "right", "solid", PARTNER],
  ["内縁・事実婚", "partner", "right", "dashed", PARTNER],
  ["婚約者", "partner", "right", "dotted", PARTNER],
  ["別居", "partner", "right", "dashed", PARTNER],
  ["離婚", "divorce", "right", "solid", PARTNER],

  // 直系卑属
  ["子", "child", "below", "solid", BLOOD],
  ["孫", "child", "below", "solid", BLOOD],
  ["曽孫", "child", "below", "solid", BLOOD, false],

  // 姻族
  ["義父", "parent", "above", "dashed", PARTNER],
  ["義母", "parent", "above", "dashed", PARTNER],
  ["義兄", "sibling", "left", "dashed", PARTNER],
  ["義姉", "sibling", "left", "dashed", PARTNER],
  ["義弟", "sibling", "right", "dashed", PARTNER],
  ["義妹", "sibling", "right", "dashed", PARTNER],

  // 養子縁組・継親子
  ["養父", "parent", "above", "dashed", BLOOD],
  ["養母", "parent", "above", "dashed", BLOOD],
  ["養子", "child", "below", "dashed", BLOOD],
  ["継父", "parent", "above", "dashed", BLOOD, false],
  ["継母", "parent", "above", "dashed", BLOOD, false],

  // 傍系親族
  ["伯父・叔父", "other", "above", "solid", BLOOD],
  ["伯母・叔母", "other", "above", "solid", BLOOD],
  ["甥", "other", "below", "solid", BLOOD],
  ["姪", "other", "below", "solid", BLOOD],
  ["いとこ", "other", "right", "solid", BLOOD],

  // 社会的関係（対人援助の場面で使う）
  ["里親", "parent", "above", "dotted", SOCIAL, false],
  ["里子", "child", "below", "dotted", SOCIAL, false],
  ["同居人", "other", "right", "dotted", SOCIAL, false],
  ["支援者", "other", "right", "dotted", SOCIAL, false],
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
      ([name, kind, direction, lineStyle, lineColor, active], index) => ({
        id: createId(),
        name,
        kind,
        direction,
        lineStyle,
        lineColor,
        sortOrder: index,
        active: active ?? true,
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
