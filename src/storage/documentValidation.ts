import type {
  ChartNodeRecord,
  GenderDefinition,
  RelationshipDefinition,
} from "../types";
import { isId } from "./ids";
import { DIRECTIONS, LINE_STYLES, RELATION_KINDS, SHAPES } from "./validation";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const color = (value: unknown) =>
  typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
const member = (value: unknown, choices: readonly string[]) =>
  typeof value === "string" && choices.includes(value);
const reference = (value: unknown) => value === null || isId(value);
const direction = (value: unknown) =>
  value === null || member(value, DIRECTIONS);
const font = (value: unknown) => finite(value) && value >= 8 && value <= 48;
const definition = (value: Record<string, unknown>) =>
  isId(value.id) &&
  typeof value.name === "string" &&
  value.name.trim().length > 0 &&
  [...value.name].length <= 40 &&
  typeof value.active === "boolean" &&
  finite(value.sortOrder);

export function isRelationship(
  value: unknown,
): value is RelationshipDefinition {
  return (
    isRecord(value) &&
    definition(value) &&
    member(value.kind, RELATION_KINDS) &&
    member(value.direction, DIRECTIONS) &&
    member(value.lineStyle, LINE_STYLES) &&
    color(value.lineColor)
  );
}
export function isGender(value: unknown): value is GenderDefinition {
  return (
    isRecord(value) &&
    definition(value) &&
    member(value.shape, SHAPES) &&
    color(value.fillColor) &&
    color(value.textColor)
  );
}
export function isNodeRecord(value: unknown): value is ChartNodeRecord {
  return (
    isRecord(value) &&
    isId(value.id) &&
    isId(value.relationshipId) &&
    isId(value.genderId) &&
    typeof value.memo === "string" &&
    font(value.fontSize) &&
    font(value.relationshipFontSize) &&
    finite(value.scale) &&
    value.scale >= 0.4 &&
    value.scale <= 2 &&
    finite(value.x) &&
    finite(value.y) &&
    reference(value.anchorNodeId) &&
    reference(value.parentNodeId1) &&
    reference(value.parentNodeId2) &&
    direction(value.placementDirection) &&
    direction(value.connectionDirection) &&
    typeof value.divorced === "boolean"
  );
}
export const uniqueIds = (values: readonly { id: string }[]) =>
  new Set(values.map((value) => value.id)).size === values.length;
