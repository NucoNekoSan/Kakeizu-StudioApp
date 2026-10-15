import type { QueryClient } from "@tanstack/react-query";
import { backupStatusKey } from "../backup/useBackup";

/** 図の増減と離脱保護に使う件数を、同じ変更として更新する。 */
export const invalidateChartCollections = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: ["charts"] }),
    client.invalidateQueries({ queryKey: backupStatusKey }),
  ]);
