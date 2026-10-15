import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChartDetail, ChartNodeRecord } from "../../types";
import { useTitleDraft } from "./useTitleDraft";
import { useSaveTracker } from "./useSaveTracker";
import { useChartNodeMutations } from "./useChartNodeMutations";
import { useChartTitleSave } from "./useChartTitleSave";
import { useDebouncedNodeUpdate } from "./useDebouncedNodeUpdate";
import { useCohabitationDocument } from "./useCohabitationDocument";
import { registerUpdatePreparation } from "../../updatePreparation";

export function useEditorPersistence(
  chartId: string,
  detail: ChartDetail | undefined,
  onDeleted: () => void,
) {
  const queryClient = useQueryClient();
  const tracker = useSaveTracker();
  const refresh = useCallback(
    (saved: ChartDetail) => {
      queryClient.setQueryData(["chart", saved.id], saved);
      void queryClient.invalidateQueries({ queryKey: ["charts"] });
    },
    [queryClient],
  );
  const mutations = useChartNodeMutations(
    chartId,
    refresh,
    undefined,
    onDeleted,
    tracker,
  );
  const titleSave = useChartTitleSave(chartId, tracker);
  const title = useTitleDraft(detail?.title, titleSave.mutateAsync);
  const cohabitation = useCohabitationDocument(chartId, detail, tracker);
  const debounce = useDebouncedNodeUpdate((request) =>
    mutations.update.mutateAsync(request),
  );
  const scheduleNodeUpdate = (
    nodeId: string,
    input: Partial<Omit<ChartNodeRecord, "id">>,
  ) => debounce.schedule({ chartId, nodeId, input });
  const saveTitle = title.flush;
  const flushAndWait = useCallback(async () => {
    // An old rejection can be superseded while these writes are settling.
    // The tracker, not Promise.all's first rejection, decides the final outcome.
    await Promise.allSettled([
      debounce.flushAndWait(),
      cohabitation.flushAndWait(),
      title.flushAndWait(),
    ]);
    await tracker.wait();
  }, [cohabitation, debounce, title, tracker]);
  useEffect(() => registerUpdatePreparation(flushAndWait), [flushAndWait]);
  const saveChanges = useCallback(() => {
    void flushAndWait().catch(() => undefined);
  }, [flushAndWait]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s" || (!event.ctrlKey && !event.metaKey))
        return;
      event.preventDefault();
      saveChanges();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveChanges]);
  const saveState =
    tracker.state === "error"
      ? "error"
      : title.isDirty || debounce.isPending || cohabitation.isDirty
        ? "saving"
        : tracker.state;
  return {
    ...mutations,
    cohabitation,
    titleSave,
    titleValue: title.value,
    onTitleChange: title.onChange,
    error: tracker.error,
    saveTitle,
    scheduleNodeUpdate,
    cancelNodeUpdate: debounce.cancelTarget,
    flushAndWait,
    saveChanges,
    saveState,
  };
}
