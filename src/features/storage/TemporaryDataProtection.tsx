import { useEffect } from "react";
import { useBackupStatus } from "../backup/useBackup";
import { useStorageState } from "./useStorageState";

/** Keep protection mounted while route components suspend or change. */
export default function TemporaryDataProtection() {
  const { mode, fallback } = useStorageState();
  const status = useBackupStatus(mode !== null);
  const atRisk =
    (mode === "session" || fallback) && (status.data?.chartCount ?? 0) > 0;
  useEffect(() => {
    if (!atRisk) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [atRisk]);
  return null;
}
