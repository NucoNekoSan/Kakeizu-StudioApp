import { ApiError } from "../api/errors";

/**
 * 保存ドキュメントのバージョニング基盤。
 * `src/features/editor/cohabitationModel.ts` の
 * 「バージョン定数 + 型ガード + empty() フォールバック」パターンの汎用化。
 */
export interface VersionedDocument {
  schemaVersion: number;
}

export interface DocumentCodec<T extends VersionedDocument> {
  readonly currentVersion: number;
  /** 現行バージョンの正しい形か */
  isCurrent(value: unknown): value is T;
  /** 旧バージョンからの移行。移行できない形は null */
  migrate?(value: unknown): T | null;
  empty(): T;
}

export const readVersion = (value: unknown): number | null => {
  if (typeof value !== "object" || value === null) return null;
  const version = (value as Record<string, unknown>).schemaVersion;
  return typeof version === "number" ? version : null;
};

/**
 * 保存値を読み出す。
 *
 * cohabitation の `loadCohabitationDocument` は壊れた値を黙って空に落とすが、
 * チャート本体でそれをやると利用者にはデータ消失に見える。読めない場合は
 * 例外を投げ、UI 側で「バックアップから復元してください」と案内する。
 */
export function readDocument<T extends VersionedDocument>(
  raw: unknown,
  codec: DocumentCodec<T>,
  label: string,
): T {
  if (raw === undefined || raw === null) return codec.empty();
  if (codec.isCurrent(raw)) return raw;

  const version = readVersion(raw);
  if (version !== null && version > codec.currentVersion)
    throw new ApiError(
      409,
      "DOCUMENT_TOO_NEW",
      `${label}は新しいバージョンで保存されています。アプリを更新してください。`,
    );

  const migrated = codec.migrate?.(raw) ?? null;
  if (migrated) return migrated;

  throw new ApiError(
    422,
    "DOCUMENT_CORRUPTED",
    `${label}を読み込めませんでした。バックアップから復元してください。`,
  );
}
