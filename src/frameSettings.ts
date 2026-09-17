export const DEFAULT_FRAME_WIDTH = 2400;
export function isFrameWidth(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1200 &&
    value <= 4800
  );
}
