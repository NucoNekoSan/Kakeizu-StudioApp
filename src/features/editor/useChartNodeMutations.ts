import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useSaveTracker, type SaveTracker } from "./useSaveTracker";
import { saveTarget, type SaveChange } from "./saveLedger";
import { api } from "../../api";
import type {
  ChartDetail,
  ChartNodeRecord,
  ChartNodeLayout,
} from "../../types";

type SaveState = (state: "saved" | "saving" | "error") => void;

export function useChartNodeMutations(
  chartId: string,
  refresh: (detail: ChartDetail) => void,
  setSaveState: SaveState | undefined,
  onDeleted: () => void,
  tracker?: SaveTracker,
) {
  const ownTracker = useSaveTracker(setSaveState);
  const activeTracker = tracker ?? ownTracker;
  function tracked<T>(
    mutation: UseMutationResult<ChartDetail, Error, T>,
    change: (value: T) => SaveChange | readonly SaveChange[],
  ) {
    const mutateAsync: typeof mutation.mutateAsync = (...args) =>
      activeTracker.track(change(args[0] as T), () =>
        mutation.mutateAsync(...args),
      );
    const mutate: typeof mutation.mutate = (...args) => {
      void mutateAsync(...args).catch(() => undefined);
    };
    return { ...mutation, mutate, mutateAsync };
  }
  const mutationOptions = {
    scope: { id: `chart-node-write:${chartId}` },
    onSuccess: (detail: ChartDetail) => {
      refresh(detail);
    },
  };
  const create = useMutation({
    mutationFn: (value: Omit<ChartNodeRecord, "id">) =>
      api.createNode(chartId, value),
    ...mutationOptions,
  });
  const update = useMutation({
    mutationFn: ({
      chartId: targetChartId,
      nodeId,
      input,
    }: {
      chartId: string;
      nodeId: string;
      input: Partial<Omit<ChartNodeRecord, "id">>;
    }) => api.updateNode(targetChartId, nodeId, input),
    ...mutationOptions,
  });
  const remove = useMutation({
    mutationFn: (nodeId: string) => api.deleteNode(chartId, nodeId),
    ...mutationOptions,
    onSuccess: (detail, nodeId) => {
      activeTracker.forget(saveTarget.node(chartId, nodeId));
      onDeleted();
      refresh(detail);
    },
  });
  const frame = useMutation({
    mutationFn: ({
      width,
      height,
      layouts,
    }: {
      width: number;
      height: number;
      layouts: ChartNodeLayout[];
    }) => api.updateNodeLayout(chartId, layouts, width, height),
    ...mutationOptions,
  });
  return {
    create: tracked(create, () => ({
      target: saveTarget.create(chartId),
      fields: ["create"],
    })),
    update: tracked(update, ({ chartId: targetChartId, nodeId, input }) => ({
      target: saveTarget.node(targetChartId, nodeId),
      fields: Object.keys(input),
    })),
    remove: tracked(remove, (nodeId) => ({
      target: saveTarget.node(chartId, nodeId),
      fields: ["exists"],
    })),
    frame: tracked(frame, ({ layouts }) => [
      { target: saveTarget.frame(chartId), fields: ["width", "height"] },
      ...layouts.map(({ id }) => ({
        target: saveTarget.node(chartId, id),
        fields: ["x", "y", "scale"],
      })),
    ]),
  };
}
