import type { User } from "../types";
import { createChartApi } from "./localCharts";
import { createSettingsApi } from "./localSettings";
import {
  createIndexedDbStore,
  createMemoryStore,
  type DocumentStore,
} from "./kv";
import { Repository } from "./repository";

/**
 * ローカル版のセッション。サーバーがないので認証は行わない。
 * Phase 2 で `RequireAuth` ごと撤去するまでの間、既存のルーティングを
 * そのまま通すための固定値を返す。
 */
const LOCAL_USER: User = { id: "local", loginId: "local" };

export function createLocalApi(store: DocumentStore) {
  const repository = new Repository(store);
  return {
    session: async () => ({ user: LOCAL_USER, csrfToken: "" }),
    login: async (_loginId: string, _password: string) => ({
      user: LOCAL_USER,
      csrfToken: "",
    }),
    logout: async () => undefined,
    ...createChartApi(repository),
    ...createSettingsApi(repository),
    /** 設定画面の「このブラウザの全データを削除」から呼ぶ (Phase 5)。 */
    clearAllData: () => repository.clear(),
  };
}

export type LocalApi = ReturnType<typeof createLocalApi>;

/**
 * 実行環境に応じたストアを1度だけ解決する。
 * IndexedDB が使えない環境 (プライベートウィンドウの一部、file:// 等) では
 * インメモリへ自動フォールバックし、アプリは動くがタブを閉じると消える。
 */
let resolved: Promise<DocumentStore> | null = null;
const defaultStore = () =>
  (resolved ??= createIndexedDbStore().catch(() => createMemoryStore()));

const lazy =
  <A extends unknown[], R>(
    pick: (api: LocalApi) => (...args: A) => Promise<R>,
  ) =>
  async (...args: A): Promise<R> =>
    pick(createLocalApi(await defaultStore()))(...args);

export const localApi = {
  session: lazy((api) => api.session),
  login: lazy((api) => api.login),
  logout: lazy((api) => api.logout),
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
};
