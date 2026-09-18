import { createBackupApi } from "./localBackup";
import { createChartApi } from "./localCharts";
import { createSettingsApi } from "./localSettings";
import {
  createIndexedDbStore,
  createMemoryStore,
  DATABASE_NAME,
  type DocumentStore,
} from "./kv";
import { Repository } from "./repository";
import {
  appStorageKeys,
  readStorageMode,
  STORAGE_MODE_KEY,
} from "./storageMode";

export function createLocalApi(store: DocumentStore) {
  const repository = new Repository(store);
  return {
    ...createChartApi(repository),
    ...createSettingsApi(repository),
    ...createBackupApi(repository),
    /** 設定画面の「このブラウザの全データを削除」から呼ぶ (Phase 5)。 */
    clearAllData: () => repository.clear(),
  };
}

export type LocalApi = ReturnType<typeof createLocalApi>;

/**
 * 実行環境と保存モードに応じたストアを1度だけ解決する。
 *
 * 「今回だけ使う」を選んだ場合はインメモリ実装を返し、IndexedDB へは触れない。
 * IndexedDB が使えない環境 (プライベートウィンドウの一部、file:// 等) でも
 * インメモリへ自動フォールバックし、アプリは動くがタブを閉じると消える。
 */
let resolved: Promise<DocumentStore> | null = null;
let didFallback = false;

const defaultStore = () =>
  (resolved ??=
    readStorageMode() === "session"
      ? Promise.resolve(createMemoryStore())
      : createIndexedDbStore().catch(() => {
          didFallback = true;
          return createMemoryStore();
        }));

/** 保存モードを切り替えたときに、次の呼び出しでストアを取り直す。 */
export const resetStoreCache = () => {
  resolved = null;
  didFallback = false;
};

/** 永続モードを選んだが IndexedDB が使えずメモリへ退避したか */
export const isStorageFallback = () => didFallback;

/**
 * この端末に残るアプリのデータをすべて消す。
 * IndexedDB のデータベースごと削除し、localStorage に残る同居データの
 * 旧キー (kakeizu:cohabitation-*) もまとめて消す。
 */
export async function clearBrowserData(): Promise<void> {
  resolved = null;
  for (const key of appStorageKeys())
    if (key !== STORAGE_MODE_KEY) {
      try {
        localStorage.removeItem(key);
      } catch {
        // 消せないキーがあっても続行する
      }
    }
  await deleteDatabase();
}

const deleteDatabase = () =>
  new Promise<void>((resolve) => {
    if (typeof indexedDB === "undefined") return resolve();
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    // 別タブが開いているとブロックされる。待ち続けないよう解決してしまう。
    request.onblocked = () => resolve();
  });

const lazy =
  <A extends unknown[], R>(
    pick: (api: LocalApi) => (...args: A) => Promise<R>,
  ) =>
  async (...args: A): Promise<R> =>
    pick(createLocalApi(await defaultStore()))(...args);

export const localApi = {
  charts: lazy((api) => api.charts),
  chart: lazy((api) => api.chart),
  createChart: lazy((api) => api.createChart),
  updateChart: lazy((api) => api.updateChart),
  deleteChart: lazy((api) => api.deleteChart),
  createNode: lazy((api) => api.createNode),
  updateNode: lazy((api) => api.updateNode),
  deleteNode: lazy((api) => api.deleteNode),
  updateNodeLayout: lazy((api) => api.updateNodeLayout),
  relationships: lazy((api) => api.relationships),
  createRelationship: lazy((api) => api.createRelationship),
  updateRelationship: lazy((api) => api.updateRelationship),
  deleteRelationship: lazy((api) => api.deleteRelationship),
  genders: lazy((api) => api.genders),
  createGender: lazy((api) => api.createGender),
  updateGender: lazy((api) => api.updateGender),
  deleteGender: lazy((api) => api.deleteGender),
  clearAllData: lazy((api) => api.clearAllData),
  backupStatus: lazy((api) => api.backupStatus),
  createBackup: lazy((api) => api.createBackup),
  markExported: lazy((api) => api.markExported),
  inspectBackup: lazy((api) => api.inspectBackup),
  isEncryptedFile: lazy((api) => api.isEncryptedFile),
  importBackup: lazy((api) => api.importBackup),
};
