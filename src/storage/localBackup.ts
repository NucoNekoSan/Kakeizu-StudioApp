import { awaitAll } from "./awaitAll";
import {
  backupFileName,
  buildBackup,
  chartBackupFileName,
  mergeDefinitions,
  parseBackup,
  resolveChartId,
  toChartDocument,
  type BackupFileV1,
  type ImportMode,
} from "./backupModel";
import { BACKUP_MAX_BYTES } from "./importLimits";
import { decryptBackup, encryptBackup, isEncryptedBackup } from "./crypto";
import { ApiError } from "../api/errors";
import { definitionsCodec } from "./defaults";
import { readDocument } from "./versioned";
import { nowIso } from "./ids";
import {
  chartKey,
  isChartKey,
  DEFINITIONS_KEY,
  META_KEY,
  emptyMeta,
  type Repository,
} from "./repository";

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

/** アプリが出力したファイルも、必ず同じ取り込み検証を通せるようにする。 */
function validateExport(json: string): void {
  try {
    if (new TextEncoder().encode(json).byteLength > BACKUP_MAX_BYTES)
      throw new Error("size");
    parseBackup(json);
  } catch {
    throw new ApiError(
      422,
      "BACKUP_EXPORT_LIMIT",
      "一括バックアップの上限（相関図1,000件・ファイル50MBなど）を超えているか、保存データに問題があります。一覧または編集画面から図ごとにJSONを書き出してください。図ごとの書き出しもできない場合は表示設定や図の内容を確認してください。",
    );
  }
}

/** 暗号化されていれば復号し、平文の JSON 文字列を返す。 */
async function unseal(raw: string, passphrase?: string): Promise<string> {
  if (raw.length > BACKUP_MAX_BYTES)
    throw new ApiError(
      422,
      "BACKUP_TOO_LARGE",
      "バックアップファイルが大きすぎます。",
    );
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
      const [meta, ids] = await awaitAll([
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
      const [definitions, charts] = await awaitAll([
        repository.definitions(),
        repository.allCharts(),
      ]);
      const backup = buildBackup(definitions, charts, APP_VERSION);
      const plain = JSON.stringify(backup, null, 2);
      validateExport(plain);
      if (!passphrase)
        return {
          fileName: backupFileName(),
          json: plain,
          backup,
          encrypted: false,
        };
      const sealed = await encryptBackup(plain, passphrase);
      const json = JSON.stringify(sealed);
      if (new TextEncoder().encode(json).byteLength > BACKUP_MAX_BYTES)
        throw new ApiError(
          422,
          "BACKUP_EXPORT_LIMIT",
          "暗号化後のバックアップが50MBを超えます。図ごとにJSONを書き出すか、図の件数を減らしてからお試しください。",
        );
      return {
        fileName: backupFileName().replace(/\.json$/, "-encrypted.json"),
        json,
        backup,
        encrypted: true,
      };
    },

    /** 現在の相関図だけを、通常の読み込み機能と互換性のある形式で書き出す。 */
    createChartBackup: async (chartId: string) => {
      const [definitions, chart] = await awaitAll([
        repository.definitions(),
        repository.chart(chartId),
      ]);
      const backup = buildBackup(definitions, [chart], APP_VERSION);
      const json = JSON.stringify(backup, null, 2);
      validateExport(json);
      return {
        fileName: chartBackupFileName(chart.title),
        json,
        backup,
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
        await repository.replaceAll([
          [META_KEY, emptyMeta()],
          [DEFINITIONS_KEY, { schemaVersion: 1, ...backup.definitions }],
          ...backup.charts.map(
            (chart) => [chartKey(chart.id), toChartDocument(chart)] as const,
          ),
        ]);
        return {
          mode,
          importedCharts: backup.charts.length,
          renamedCharts: 0,
          addedDefinitions: 0,
        };
      }

      let result!: ImportResult;
      await repository.updateAll((entries) => {
        const next = new Map(entries);
        const rawDefinitions = next.get(DEFINITIONS_KEY);
        const current =
          rawDefinitions === undefined
            ? definitionsCodec.empty()
            : readDocument(rawDefinitions, definitionsCodec, "表示設定");
        const merged = mergeDefinitions(current, backup.definitions);
        next.set(DEFINITIONS_KEY, merged);
        const taken = new Set(
          [...next.keys()]
            .filter(isChartKey)
            .map((key) => key.slice("chart:".length)),
        );
        let renamedCharts = 0;
        for (const chart of backup.charts) {
          const id = resolveChartId(chart, taken);
          if (id !== chart.id) renamedCharts += 1;
          taken.add(id);
          next.set(chartKey(id), {
            ...toChartDocument(chart, id),
            updatedAt: nowIso(),
          });
        }
        result = {
          mode,
          importedCharts: backup.charts.length,
          renamedCharts,
          addedDefinitions:
            merged.relationships.length -
            current.relationships.length +
            merged.genders.length -
            current.genders.length,
        };
        return [...next];
      });
      return result;
    },
  };
}
