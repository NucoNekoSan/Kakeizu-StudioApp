import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api";
import { getErrorMessage } from "../../domain";
import { readTextFile, saveJsonFile } from "../../storage/fileIo";
import type { ImportMode } from "../../storage/backupModel";

export const backupStatusKey = ["backup-status"];

export function useBackupStatus() {
  return useQuery({ queryKey: backupStatusKey, queryFn: api.backupStatus });
}

/** 未バックアップの警告を出すしきい値。 */
export const BACKUP_WARNING_DAYS = 7;

export function useBackup() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  const exportBackup = useCallback(
    async (passphrase?: string) => {
      setBusy("export");
      setError("");
      setMessage("");
      try {
        const { fileName, json } = await api.createBackup(passphrase);
        const saved = await saveJsonFile(fileName, json);
        if (!saved) return;
        await api.markExported();
        await queryClient.invalidateQueries({ queryKey: backupStatusKey });
        setMessage(
          `${fileName} を書き出しました。` +
            (passphrase ? "パスフレーズを忘れると復元できません。" : ""),
        );
      } catch (caught) {
        setError(getErrorMessage(caught));
      } finally {
        setBusy(null);
      }
    },
    [queryClient],
  );

  const importBackup = useCallback(
    async (raw: string, mode: ImportMode, passphrase?: string) => {
      setBusy("import");
      setError("");
      setMessage("");
      try {
        const result = await api.importBackup(raw, mode, passphrase);
        await refresh();
        setMessage(
          result.mode === "replace"
            ? `${result.importedCharts}件の相関図で置き換えました。`
            : `${result.importedCharts}件の相関図を追加しました。` +
                (result.renamedCharts
                  ? `（うち${result.renamedCharts}件は既存と重複したため複製として追加）`
                  : ""),
        );
      } catch (caught) {
        setError(getErrorMessage(caught));
      } finally {
        setBusy(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [refresh],
  );

  return {
    busy,
    error,
    message,
    fileRef,
    exportBackup,
    importBackup,
    readTextFile,
  };
}
