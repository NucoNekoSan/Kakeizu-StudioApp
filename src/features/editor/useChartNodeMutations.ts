import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
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
  setSaveState: SaveState,
  onDeleted: () => void,
) {
  const pendingCount = useRef(0);
  const batchStartedAt = useRef(0);
  const hasBatchError = useRef(false);
  const isMounted = useRef(true);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);
  const beginMutation = () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = null;
    if (pendingCount.current === 0) {
      batchStartedAt.current = Date.now();
      hasBatchError.current = false;
    }
    pendingCount.current += 1;
    if (isMounted.current) setSaveState("saving");
  };
  const finishMutation = (hasError: boolean) => {
    hasBatchError.current ||= hasError;
    pendingCount.current = Math.max(0, pendingCount.current - 1);
    if (pendingCount.current > 0 || !isMounted.current) return;
    if (hasBatchError.current) {
      setSaveState("error");
      return;
    }
    const remaining = Math.max(0, 500 - (Date.now() - batchStartedAt.current));
    savedTimer.current = setTimeout(() => {
      savedTimer.current = null;
      if (isMounted.current && pendingCount.current === 0)
        setSaveState("saved");
    }, remaining);
  };
  const mutationOptions = {
    scope: { id: `chart-node-write:${chartId}` },
    onMutate: beginMutation,
    onSuccess: (detail: ChartDetail) => {
      refresh(detail);
    },
    onSettled: (_detail: ChartDetail | undefined, error: Error | null) => {
      finishMutation(error !== null);
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
    onSuccess: (detail) => {
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
  return { create, update, remove, frame };
}
