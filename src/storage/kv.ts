/**
 * ドキュメントストアの抽象。
 *
 * IndexedDB 実装 (`idb-keyval`) への依存をこのファイル1つに閉じ込めている。
 * - テストではインメモリ実装を注入して jsdom / IDB モックなしで検証する
 * - 「今回だけ使う」一時利用モードでもインメモリ実装へ差し替えるだけでよい
 *   (IndexedDB へ一切書かないので端末に残留しないことが構造的に保証される)
 *
 * `src/features/editor/cohabitationStorage.ts` が `CohabitationStorage` を
 * 受け取る既存パターンと同じ考え方。
 */
export interface DocumentStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
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
    async clear() {
      map.clear();
    },
  };
}

export async function createIndexedDbStore(): Promise<DocumentStore> {
  const { createStore, get, set, del, keys, clear } =
    await import("idb-keyval");
  const store = createStore(DATABASE_NAME, STORE_NAME);
  return {
    get: <T>(key: string) => get<T>(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    keys: async () => (await keys(store)).map(String),
    clear: () => clear(store),
  };
}
