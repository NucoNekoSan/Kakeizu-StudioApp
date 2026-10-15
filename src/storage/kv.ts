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
export interface DocumentStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
  replaceAll(entries: readonly (readonly [string, unknown])[]): Promise<void>;
}

export const DATABASE_NAME = "kakeizu-studio";
export const STORE_NAME = "documents";

export function createMemoryStore(
  seed?: Iterable<readonly [string, unknown]>,
): DocumentStore {
  const map = new Map<string, string>();
  for (const [key, value] of seed ?? [])
    map.set(key, JSON.stringify(value ?? null));
  // 値は JSON 文字列として保持する。IndexedDB の structured clone と同様に
  // 呼び出し側が受け取った値を書き換えても保存内容が変わらないようにするため。
  return {
    async get<T>(key: string) {
      const raw = map.get(key);
      return raw === undefined ? undefined : (JSON.parse(raw) as T);
    },
    async set(key, value) {
      map.set(key, JSON.stringify(value ?? null));
    },
    async del(key) {
      map.delete(key);
    },
    async keys() {
      return [...map.keys()];
    },
    async replaceAll(entries) {
      const next = entries.map(
        ([key, value]) => [key, JSON.stringify(value ?? null)] as const,
      );
      map.clear();
      for (const [key, value] of next) map.set(key, value);
    },
    async clear() {
      map.clear();
    },
  };
}

export async function createIndexedDbStore(): Promise<DocumentStore> {
  const { createStore, get, set, del, keys, clear, promisifyRequest } =
    await import("idb-keyval");
  const store = createStore(DATABASE_NAME, STORE_NAME);
  return {
    get: <T>(key: string) => get<T>(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    keys: async () => (await keys(store)).map(String),
    clear: () => clear(store),
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
