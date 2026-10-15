import { useCallback, useState } from "react";
import { api } from "../../api";
import { getErrorMessage } from "../../domain";
import { prepareFileSave, saveJsonFile } from "../../storage/fileIo";
import { chartBackupFileName } from "../../storage/backupModel";

type Options = {
  chartId: string;
  title?: string;
  draftTitle: string;
  beforeExport(): Promise<void>;
  announce(message: string): void;
  onSaved(): void;
};

export function useChartJsonExport({
  chartId,
  title,
  draftTitle,
  beforeExport,
  announce,
  onSaved,
}: Options) {
  const [isJsonExporting, setIsJsonExporting] = useState(false);
  const exportCurrentChart = useCallback(async () => {
    setIsJsonExporting(true);
    try {
      const suggestedName = chartBackupFileName(
        draftTitle.trim() || title || "相関図",
      );
      // Open the picker during the click, before waiting for storage writes.
      const target = await prepareFileSave(suggestedName, {
        description: "JSONファイル",
        mimeType: "application/json",
        extension: ".json",
      });
      if (!target) return;
      await beforeExport();
      const { fileName, json } = await api.createChartBackup(chartId);
      const saved = await saveJsonFile(fileName, json, target);
      if (saved) {
        announce(`${fileName} を書き出しました。`);
        onSaved();
      }
    } catch (caught) {
      announce(
        `JSONファイルを書き出せませんでした。${getErrorMessage(caught)}`,
      );
    } finally {
      setIsJsonExporting(false);
    }
  }, [chartId, title, draftTitle, beforeExport, announce, onSaved]);
  return { exportCurrentChart, isJsonExporting };
}
