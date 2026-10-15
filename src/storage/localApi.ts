import { ApiError } from "../api/errors";
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
import { orderedApi } from "./operationQueue";
import type { LegacyStorage } from "./migrateCohabitation";
import {
  appStorageKeys,
  readStorageMode,
  STORAGE_MODE_KEY,
} from "./storageMode";

export function createLocalApi(
  store: DocumentStore,
  options: { legacyStorage?: LegacyStorage } = {},
) {
  const repository = new Repository(store, options.legacyStorage);
  return orderedApi(store, {
    ...createChartApi(repository),
    ...createSettingsApi(repository),
    ...createBackupApi(repository),
    /** 設定画面の「このブラウザの全データを削除」から呼ぶ (Phase 5)。 */
    clearAllData: () => repository.clear(),
  });
}

export type LocalApi = ReturnType<typeof createLocalApi>;

/**
 * 実行環境と保存モードに応じたストアを1度だけ解決する。
 *
 * 「今回だけ使う」を選んだ場合はインメモリ実装を返し、IndexedDB へは触れない。
 * IndexedDB が使えない環境 (プライベートウィンドウの一部、file:// 等) でも
 * インメモリへ自動フォールバックし、アプリは動くがタブを閉じると消える。
 */
let resolved: Promise<LocalApi> | null = null;
const defaultApi = () => {
  if (resolved) return resolved;
  resolved = (async () => {
    if (readStorageMode() === "session")
      return createLocalApi(createMemoryStore());
    let store: DocumentStore;
    try {
      store = await createIndexedDbStore();
      // Opening a store is lazy: probe availability without decoding any chart.
      await store.keys();
    } catch {
      return createLocalApi(createMemoryStore());
    }
    let storage: LegacyStorage | undefined;
    try {
      storage = globalThis.localStorage;
    } catch {
      /* unavailable */
    }
    return createLocalApi(store, { legacyStorage: storage });
  })().catch((error) => {
    resolved = null;
    throw error;
  });
  return resolved;
};

/** 保存モードを切り替えたときに、次の呼び出しでストアを取り直す。 */
export const resetStoreCache = () => {
  resolved = null;
};

/**
 * この端末に残るアプリのデータをすべて消す。
 * IndexedDB のデータベースごと削除し、localStorage に残る同居データの
 * 旧キー (kakeizu:cohabitation-*) もまとめて消す。
 */
export async function clearBrowserData(): Promise<void> {
  resolved = null;
  // 先に本体を消す。保留や失敗で例外になったとき、一部だけ消えた状態にしない。
  await deleteDatabase();
  for (const getStorage of [() => localStorage, () => sessionStorage])
    try {
      const storage = getStorage();
      for (const key of appStorageKeys(storage))
        if (key !== STORAGE_MODE_KEY) storage.removeItem(key);
    } catch {
      // 消せないキーがあっても続行する
    }
}

/** 別タブの接続が閉じるのを待つ時間。超えたら削除できていないと報告する。 */
export const DELETE_BLOCKED_TIMEOUT_MS = 4000;

const deleteDatabase = () =>
  new Promise<void>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return resolve();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => {
      clearTimeout(timer);
      resolve();
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(
        new ApiError(
          500,
          "DATA_DELETE_FAILED",
          "データを削除できませんでした。ブラウザの設定からこのサイトのデータを削除してください。",
        ),
      );
    };
    // 別タブが開いていると削除が保留される。成功扱いにせず、閉じるのを待つ。
    request.onblocked = () => {
      timer ??= setTimeout(
        () =>
          reject(
            new ApiError(
              409,
              "DATA_DELETE_BLOCKED",
              "別のタブでこのアプリが開かれているため、データを削除できませんでした。他のタブを閉じてからもう一度お試しください。",
            ),
          ),
        DELETE_BLOCKED_TIMEOUT_MS,
      );
    };
  });

const lazy =
  <A extends unknown[], R>(
    pick: (api: LocalApi) => (...args: A) => Promise<R>,
  ) =>
  async (...args: A): Promise<R> =>
    pick(await defaultApi())(...args);

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
  updateCohabitation: lazy((api) => api.updateCohabitation),
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
  createChartBackup: lazy((api) => api.createChartBackup),
  markExported: lazy((api) => api.markExported),
  inspectBackup: lazy((api) => api.inspectBackup),
  isEncryptedFile: lazy((api) => api.isEncryptedFile),
  importBackup: lazy((api) => api.importBackup),
};
