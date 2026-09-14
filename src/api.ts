import { localApi } from "./storage/localApi";

export { ApiError } from "./api/errors";

/**
 * データアクセスの唯一の差し替え点。
 * v3 以降はサーバーを持たず、利用者の端末内 (IndexedDB) だけに保存する。
 * PHP API 版は `legacy/php-server` ブランチを参照。
 */
export const api = localApi;
