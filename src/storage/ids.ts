/**
 * PHP 版の `App::id()` (bin2hex(random_bytes(16))) と同じ 32 桁 hex を生成する。
 * 既存データの ID 形式・バリデーション正規表現との互換のため形式を変えない。
 */
export const ID_PATTERN = /^[a-f0-9]{32}$/;

export function createId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const isId = (value: unknown): value is string =>
  typeof value === "string" && ID_PATTERN.test(value);

export const nowIso = () => new Date().toISOString();
