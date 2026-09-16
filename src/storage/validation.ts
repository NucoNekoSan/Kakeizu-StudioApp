import { validationError } from "../api/errors";
import type { Direction, LineStyle, RelationKind, Shape } from "../types";

/**
 * `server/src/api_helpers.php` のバリデーション規則の移植。
 * 規則を変えるとサーバー版で作られた既存データと非互換になるため、
 * 境界値 (8-48 / 0.4-2.0 / 2000 / 80 / 40) は PHP 版と一致させている。
 */
export const DIRECTIONS: readonly Direction[] = [
  "above",
  "below",
  "left",
  "right",
];
export const LINE_STYLES: readonly LineStyle[] = ["solid", "dashed", "dotted"];
export const SHAPES: readonly Shape[] = ["circle", "square", "diamond"];
export const RELATION_KINDS: readonly RelationKind[] = [
  "self",
  "parent",
  "child",
  "partner",
  "sibling",
  "divorce",
  "other",
];

export const MEMO_MAX = 2000;
export const TITLE_MAX = 80;
export const DEFINITION_NAME_MAX = 40;
export const LAYOUT_NODES_MAX = 500;

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function text(
  value: unknown,
  key: string,
  max: number,
  message = "入力内容を確認してください",
): string {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "" || [...trimmed].length > max)
    throw validationError(message, {
      [key]: `1〜${max}文字で入力してください`,
    });
  return trimmed;
}

/** メモは PHP 版と同じく「切り詰め」であり、超過してもエラーにしない。 */
export const clampMemo = (value: unknown) =>
  [...String(value ?? "")].slice(0, MEMO_MAX).join("");

export function color(value: unknown, message: string): string {
  if (typeof value !== "string" || !COLOR_PATTERN.test(value))
    throw validationError(message);
  return value;
}

export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  message: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    throw validationError(message);
  return value as T;
}

export function fontSize(value: unknown, label: string): number {
  if (typeof value !== "number" && typeof value !== "string")
    throw validationError(`${label}のフォントサイズを確認してください`);
  const size = Number(value);
  if (!Number.isFinite(size))
    throw validationError(`${label}のフォントサイズを確認してください`);
  const rounded = Math.trunc(size);
  if (rounded < 8 || rounded > 48)
    throw validationError(
      `${label}のフォントサイズは8〜48pxで指定してください`,
    );
  return rounded;
}

export function scale(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0.4 || parsed > 2.0)
    throw validationError("ノード倍率は0.4〜2.0で指定してください");
  return parsed;
}

export function coordinate(value: unknown): number {
  const parsed = Number(value);
  if (value === null || value === "" || !Number.isFinite(parsed))
    throw validationError("ノード座標を確認してください");
  return parsed;
}

export const boolValue = (value: unknown): boolean =>
  value === true || value === 1 || value === "1" || value === "true";

export function sortOrder(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}
