import {
  backupFileName,
  buildBackup,
  mergeDefinitions,
  parseBackup,
  resolveChartId,
  toChartDocument,
  type BackupFileV1,
  type ImportMode,
} from "./backupModel";
import { decryptBackup, encryptBackup, isEncryptedBackup } from "./crypto";
import { ApiError } from "../api/errors";
import type { Repository } from "./repository";

export interface BackupStatus {
  chartCount: number;
  lastExportedAt: string | null;
  /** 最終エクスポートからの経過日数。一度も書き出していなければ null */
  daysSinceExport: number | null;
}

export interface ImportResult {
  mode: ImportMode;
  importedCharts: number;
  renamedCharts: number;
  addedDefinitions: number;
}

const APP_VERSION = "3.0.0-dev";
const DAY = 24 * 60 * 60 * 1000;

/** 暗号化されていれば復号し、平文の JSON 文字列を返す。 */
async function unseal(raw: string, passphrase?: string): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw; // 形式エラーは parseBackup 側で統一して扱う
  }
  if (!isEncryptedBackup(parsed)) return raw;
  if (!passphrase)
    throw new ApiError(
      401,
      "PASSPHRASE_REQUIRED",
      "このファイルは暗号化されています。パスフレーズを入力してください。",
    );
  return decryptBackup(parsed, passphrase);
}

export function createBackupApi(repository: Repository) {
  return {
    backupStatus: async (): Promise<BackupStatus> => {
      const [meta, ids] = await Promise.all([
        repository.meta(),
        repository.chartIds(),
      ]);
      const lastExportedAt = meta.lastExportedAt ?? null;
      return {
        chartCount: ids.length,
        lastExportedAt,
        daysSinceExport: lastExportedAt
          ? Math.floor((Date.now() - Date.parse(lastExportedAt)) / DAY)
          : null,
      };
    },

    /**
     * 書き出すだけで保存はしない。ファイル保存は呼び出し側 (fileIo) が行う。
     * パスフレーズを渡すとファイル全体を暗号化する。
     */
    createBackup: async (
      passphrase?: string,
    ): Promise<{
      fileName: string;
      json: string;
      backup: BackupFileV1;
      encrypted: boolean;
    }> => {
      const [definitions, charts] = await Promise.all([
        repository.definitions(),
        repository.allCharts(),
      ]);
      const backup = buildBackup(definitions, charts, APP_VERSION);
      const plain = JSON.stringify(backup, null, 2);
      if (!passphrase)
        return {
          fileName: backupFileName(),
          json: plain,
          backup,
          encrypted: false,
        };
      const sealed = await encryptBackup(plain, passphrase);
      return {
        fileName: backupFileName().replace(/\.json$/, "-encrypted.json"),
        json: JSON.stringify(sealed),
        backup,
        encrypted: true,
      };
    },

    /** 保存が成功したあとに呼ぶ。未バックアップ警告の起点になる。 */
    markExported: async (): Promise<void> => {
      const meta = await repository.meta();
      await repository.setMeta({
        ...meta,
        lastExportedAt: new Date().toISOString(),
      });
    },

    /** ファイルが暗号化されているかだけを先に判定する (入力欄の出し分け用)。 */
    isEncryptedFile: async (raw: string): Promise<boolean> => {
      try {
        return isEncryptedBackup(JSON.parse(raw));
      } catch {
        return false;
      }
    },

    /** ファイルの中身だけ検証する (取り込み前の確認表示用)。 */
    inspectBackup: async (raw: string, passphrase?: string) => {
      const backup = parseBackup(await unseal(raw, passphrase));
      return {
        exportedAt: backup.exportedAt,
        appVersion: backup.appVersion,
        chartCount: backup.charts.length,
        titles: backup.charts.map((chart) => chart.title),
      };
    },

    importBackup: async (
      raw: string,
      mode: ImportMode = "merge",
      passphrase?: string,
    ): Promise<ImportResult> => {
      const backup = parseBackup(await unseal(raw, passphrase));

      if (mode === "replace") {
        // 置き換えは現在のデータを完全に捨てる。UI 側で必ず確認を取ること。
        await repository.clear();
        await repository.saveDefinitions({
          schemaVersion: 1,
          relationships: backup.definitions.relationships,
          genders: backup.definitions.genders,
        });
        for (const chart of backup.charts)
          await repository.saveChart(toChartDocument(chart));
        return {
          mode,
          importedCharts: backup.charts.length,
          renamedCharts: 0,
          addedDefinitions: 0,
        };
      }

      const current = await repository.definitions();
      const merged = mergeDefinitions(current, backup.definitions);
      await repository.saveDefinitions(merged);

      const taken = new Set(await repository.chartIds());
      let renamedCharts = 0;
      for (const chart of backup.charts) {
        const id = resolveChartId(chart, taken);
        if (id !== chart.id) renamedCharts += 1;
        taken.add(id);
        await repository.saveChart(toChartDocument(chart, id));
      }
      return {
        mode,
        importedCharts: backup.charts.length,
        renamedCharts,
        addedDefinitions:
          merged.relationships.length -
          current.relationships.length +
          (merged.genders.length - current.genders.length),
      };
    },
  };
}
