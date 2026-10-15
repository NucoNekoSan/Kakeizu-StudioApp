/**
 * ドキュメントストアの抽象。
 *
 * IndexedDB 実装 (`idb-keyval`) への依存をこのファイル1つに閉じ込めている。
 * - テストではインメモリ実装を注入して jsdom / IDB モックなしで検証する
 * - 「今回だけ使う」一時利用モードでもインメモリ実装へ差し替えるだけでよい
 *   (IndexedDB へ一切書かないので端末に残留しないことが構造的に保証される)
 *
 * 同居情報も含むすべての相関図データを、このストア経由で保存する。
 */
import { get, set, del, keys, clear, promisifyRequest } from "idb-keyval";
import { createStoreLifetime } from "./storeLifetime";
import { ApiError } from "../api/errors";

export type StoreEntries = readonly (readonly [string, unknown])[];

export interface DocumentStore {
  /** Serialize a complete async API operation across persistent-store clients. */
  runExclusive?<T>(operation: () => Promise<T>): Promise<T>;
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
  replaceAll(entries: readonly (readonly [string, unknown])[]): Promise<void>;
  /** 同じreadwriteトランザクションで現状を読み、変更を全件まとめて確定する。 */
  updateAll(update: (entries: StoreEntries) => StoreEntries): Promise<void>;
}

export const DATABASE_NAME = "kakeizu-studio";
export const STORE_NAME = "documents";

export function createMemoryStore(
  seed?: Iterable<readonly [string, unknown]>,
): DocumentStore {
  const lifetime = createStoreLifetime();
  const map = new Map<string, string>();
  for (const [key, value] of seed ?? [])
    map.set(key, JSON.stringify(value ?? null));
  // 値は JSON 文字列として保持する。IndexedDB の structured clone と同様に
  // 呼び出し側が受け取った値を書き換えても保存内容が変わらないようにするため。
  return {
    async get<T>(key: string) {
      lifetime.assertActive();
      const raw = map.get(key);
      return raw === undefined ? undefined : (JSON.parse(raw) as T);
    },
    async set(key, value) {
      lifetime.assertActive();
      map.set(key, JSON.stringify(value ?? null));
    },
    async del(key) {
      lifetime.assertActive();
      map.delete(key);
    },
    async keys() {
      lifetime.assertActive();
      return [...map.keys()];
    },
    async replaceAll(entries) {
      lifetime.assertActive();
      const next = entries.map(
        ([key, value]) => [key, JSON.stringify(value ?? null)] as const,
      );
      map.clear();
      for (const [key, value] of next) map.set(key, value);
    },
    async updateAll(update) {
      lifetime.assertActive();
      const entries = [...map].map(
        ([key, raw]) => [key, JSON.parse(raw)] as const,
      );
      const next = update(entries).map(
        ([key, value]) => [key, JSON.stringify(value ?? null)] as const,
      );
      map.clear();
      for (const [key, value] of next) map.set(key, value);
    },
    async clear() {
      lifetime.assertActive();
      map.clear();
    },
  };
}

/**
 * idb-keyval の createStore と同じ形のストア取得関数。
 *
 * 違いは `versionchange` で接続を閉じること。idb-keyval 既定の接続は
 * 閉じないため、別タブや同じタブの接続が残っていると
 * `indexedDB.deleteDatabase` が待たされ、「全データ削除」が完了しない。
 * 削除前の参照を失効させ、古い処理によるデータの再作成を防ぐ。
 */
function createClosableStore(
  promisifyRequest: <T>(request: IDBRequest<T>) => Promise<T>,
): {
  store: UseStoreFn;
  ready: Promise<IDBDatabase>;
  assertActive: () => void;
} {
  const lifetime = createStoreLifetime();
  let dbp: Promise<IDBDatabase> | undefined;
  const getDB = () => {
    lifetime.assertActive();
    if (dbp) return dbp;
    const request = indexedDB.open(DATABASE_NAME);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE_NAME);
    const opened = promisifyRequest(request);
    dbp = opened;
    opened.then(
      (db) => {
        db.onversionchange = () => {
          lifetime.revoke();
          db.close();
          if (dbp === opened) dbp = undefined;
        };
        db.onclose = () => {
          lifetime.revoke();
          if (dbp === opened) dbp = undefined;
        };
      },
      () => {
        if (dbp === opened) dbp = undefined;
      },
    );
    return opened;
  };
  // Open before the first await: even a store whose caller is decrypting must
  // receive versionchange if another tab deletes the database.
  const ready = getDB();
  return {
    ready,
    assertActive: lifetime.assertActive,
    store: async (mode, callback) => {
      const db = await getDB();
      lifetime.assertActive();
      return callback(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    },
  };
}

type UseStoreFn = <T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => T | PromiseLike<T>,
) => Promise<T>;

export async function createIndexedDbStore(): Promise<DocumentStore> {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request)
    throw new ApiError(
      503,
      "STORAGE_LOCK_UNAVAILABLE",
      "この環境では安全な端末保存を利用できません。",
    );
  const { store, ready, assertActive } = createClosableStore(promisifyRequest);
  await ready;
  return {
    runExclusive: (operation) =>
      locks.request("kakeizu-studio:documents", { mode: "exclusive" }, () => {
        assertActive();
        return operation();
      }),
    get: <T>(key: string) => get<T>(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    keys: async () => (await keys(store)).map(String),
    clear: () => clear(store),
    updateAll: (update) =>
      store("readwrite", async (target) => {
        const completion = promisifyRequest(target.transaction);
        try {
          const [keys, values] = await Promise.all([
            promisifyRequest(target.getAllKeys()),
            promisifyRequest(target.getAll()),
          ]);
          const next = update(
            keys.map((key, index) => [String(key), values[index]] as const),
          );
          target.clear();
          for (const [key, value] of next) target.put(value, key);
        } catch (error) {
          target.transaction.abort();
          await completion.catch(() => undefined);
          throw error;
        }
        await completion;
      }),
    replaceAll: (entries) =>
      store("readwrite", (target) => {
        const completion = promisifyRequest(target.transaction);
        try {
          target.clear();
          for (const [key, value] of entries) target.put(value, key);
        } catch (error) {
          // A synchronous clone error must also roll back the preceding clear.
          target.transaction.abort();
          return completion.then(
            () => {
              throw error;
            },
            () => {
              throw error;
            },
          );
        }
        return completion;
      }),
  };
}
