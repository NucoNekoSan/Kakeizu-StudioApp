import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveTarget } from "./saveLedger";
import { api } from "../../api";
import type { ChartDetail } from "../../types";
import type { SaveTracker } from "./useSaveTracker";

export function useChartTitleSave(chartId: string, tracker?: SaveTracker) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    scope: { id: `chart-node-write:${chartId}` },
    mutationFn: (title: string) => api.updateChart(chartId, title),
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: ["charts"] });
      queryClient.setQueryData<ChartDetail>(["chart", chartId], (previous) =>
        previous
          ? { ...previous, title: summary.title, updatedAt: summary.updatedAt }
          : previous,
      );
    },
  });
  const mutateAsync: typeof mutation.mutateAsync = (title, options) =>
    tracker
      ? tracker.track(
          { target: saveTarget.title(chartId), fields: ["title"] },
          () => mutation.mutateAsync(title, options),
        )
      : mutation.mutateAsync(title, options);
  const mutate: typeof mutation.mutate = (title, options) => {
    void mutateAsync(title, options).catch(() => undefined);
  };
  return {
    ...mutation,
    error: tracker
      ? tracker.errorFor(saveTarget.title(chartId))
      : mutation.error,
    mutateAsync,
    mutate,
  };
}
