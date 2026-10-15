import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api";
import {
  emptyCohabitationDocument,
  type Cohabitation,
  type CohabitationLabel,
  type CohabitationDocument,
} from "../../cohabitation";
import type { ChartDetail } from "../../types";
import { useSaveTracker, type SaveTracker } from "./useSaveTracker";
import { saveTarget } from "./saveLedger";

type DocumentUpdate = SetStateAction<CohabitationDocument>;

export function useCohabitationDocument(
  chartId: string,
  detail?: ChartDetail,
  tracker?: SaveTracker,
) {
  const queryClient = useQueryClient();
  const [document, setDocumentState] = useState(emptyCohabitationDocument);
  const [isDirty, setDirty] = useState(false);
  const ownTracker = useSaveTracker();
  const activeTracker = tracker ?? ownTracker;
  const target = saveTarget.cohabitation(chartId);
  const storageError = activeTracker.errorFor(target) !== null;
  const current = useRef(document);
  const revision = useRef(0);
  const submitted = useRef(0);
  const lastWrite = useRef<Promise<unknown>>(Promise.resolve());
  const dirty = useRef(false);
  useEffect(() => {
    if (!detail || dirty.current) return;
    current.current = detail.cohabitation ?? emptyCohabitationDocument();
    setDocumentState(current.current);
  }, [detail]);
  const setDocument = useCallback((update: DocumentUpdate) => {
    current.current =
      typeof update === "function" ? update(current.current) : update;
    revision.current += 1;
    dirty.current = true;
    setDocumentState(current.current);
    setDirty(true);
  }, []);
  const persist = useCallback(
    (retry = false) => {
      if (
        !dirty.current ||
        (submitted.current === revision.current &&
          (!retry || activeTracker.errorFor(target) === null))
      )
        return lastWrite.current;
      const version = revision.current;
      const next = current.current;
      submitted.current = version;
      const operation = () => api.updateCohabitation(chartId, next);
      const promise = activeTracker.track(
        { target, fields: ["document"] },
        operation,
      );
      lastWrite.current = promise.then((saved) => {
        if (version === revision.current) {
          dirty.current = false;
          current.current = saved.cohabitation ?? next;
          setDocumentState(current.current);
          setDirty(false);
        }
        queryClient.setQueryData<ChartDetail>(["chart", chartId], (previous) =>
          previous
            ? {
                ...previous,
                cohabitation: saved.cohabitation,
                updatedAt: saved.updatedAt,
              }
            : saved,
        );
      });
      // Background saves report through state; explicit flush still rejects.
      void lastWrite.current.catch(() => undefined);
      return lastWrite.current;
    },
    [chartId, queryClient, activeTracker, target],
  );
  useEffect(() => {
    if (detail) void persist().catch(() => undefined);
  }, [detail, document, persist]);
  const flushAndWait = useCallback(async () => {
    while (dirty.current) {
      const version = revision.current;
      try {
        await persist(true);
      } catch (error) {
        if (revision.current === version) throw error;
      }
    }
  }, [persist]);
  const setCohabitations = useCallback(
    (update: SetStateAction<Cohabitation[]>) =>
      setDocument((value) => ({
        ...value,
        cohabitations:
          typeof update === "function" ? update(value.cohabitations) : update,
      })),
    [setDocument],
  );
  const setCohabitationLabels = useCallback(
    (update: SetStateAction<CohabitationLabel[]>) =>
      setDocument((value) => ({
        ...value,
        labels: typeof update === "function" ? update(value.labels) : update,
      })),
    [setDocument],
  );
  return {
    document,
    setDocument,
    cohabitations: document.cohabitations,
    setCohabitations,
    cohabitationLabels: document.labels,
    setCohabitationLabels,
    isHydrated: !!detail,
    isDirty,
    storageError,
    flushAndWait,
  };
}
