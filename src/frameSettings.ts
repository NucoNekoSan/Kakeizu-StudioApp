export const DEFAULT_FRAME_WIDTH = 2400;
export const DEFAULT_FRAME_HEIGHT = 1200;
export function isFrameHeight(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 600 &&
    value <= 4800
  );
}
export function isFrameWidth(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1200 &&
    value <= 4800
  );
}
