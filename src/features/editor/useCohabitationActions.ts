import { useCallback, useEffect, useState, type SetStateAction } from "react";
import type { ChartDetail } from "../../types";
import type { useCohabitationDocument } from "./useCohabitationDocument";

type Selection = { kind: "group" | "label"; id: string } | null;
type Tool = "lasso" | "label" | null;
export function useCohabitationActions(
  detail: ChartDetail | undefined,
  document: ReturnType<typeof useCohabitationDocument>,
) {
  const { cohabitations, setCohabitations, setCohabitationLabels } = document;
  const [selection, setSelection] = useState<Selection>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [announcement, setAnnouncement] = useState("");
  const selectedCohabitation =
    selection?.kind === "group" ? selection.id : null;
  const selectedLabel = selection?.kind === "label" ? selection.id : null;
  const setSelectedCohabitation = useCallback(
    (id: string | null) =>
      setSelection((current) =>
        id ? { kind: "group", id } : current?.kind === "group" ? null : current,
      ),
    [],
  );
  const setSelectedLabel = useCallback(
    (id: string | null) =>
      setSelection((current) =>
        id ? { kind: "label", id } : current?.kind === "label" ? null : current,
      ),
    [],
  );
  const setLassoMode = useCallback(
    (update: SetStateAction<boolean>) =>
      setTool((current) =>
        (typeof update === "function" ? update(current === "lasso") : update)
          ? "lasso"
          : current === "lasso"
            ? null
            : current,
      ),
    [],
  );
  const setLabelMode = useCallback(
    (update: SetStateAction<boolean>) =>
      setTool((current) =>
        (typeof update === "function" ? update(current === "label") : update)
          ? "label"
          : current === "label"
            ? null
            : current,
      ),
    [],
  );
  useEffect(() => {
    if (!detail || !document.isHydrated) return;
    const validNodeIds = new Set(detail.nodes.map((node) => node.id));
    const next = cohabitations.flatMap((group) => {
      const nodeIds = group.nodeIds.filter((nodeId) =>
        validNodeIds.has(nodeId),
      );
      if (nodeIds.length < 1) return [];
      return nodeIds.length === group.nodeIds.length
        ? [group]
        : [{ ...group, nodeIds }];
    });
    if (
      next.length !== cohabitations.length ||
      next.some((group, index) => group !== cohabitations[index])
    )
      setCohabitations(next);
  }, [detail, cohabitations, document.isHydrated, setCohabitations]);
  const requestDeleteCohabitation = useCallback(() => {
    const message = selectedCohabitation
      ? "この同居輪を削除しますか？"
      : "この同居文字を削除しますか？";
    if ((!selectedCohabitation && !selectedLabel) || !confirm(message)) return;
    if (selectedCohabitation)
      setCohabitations((items) =>
        items.filter((item) => item.id !== selectedCohabitation),
      );
    if (selectedLabel)
      setCohabitationLabels((items) =>
        items.filter((item) => item.id !== selectedLabel),
      );
    setSelectedCohabitation(null);
    setSelectedLabel(null);
    setAnnouncement(
      selectedCohabitation ? "同居輪を削除しました" : "同居文字を削除しました",
    );
  }, [
    selectedCohabitation,
    selectedLabel,
    setSelectedCohabitation,
    setSelectedLabel,
    setCohabitationLabels,
    setCohabitations,
  ]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (!selectedCohabitation && !selectedLabel) ||
        !["Delete", "Backspace"].includes(event.key)
      )
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      )
        return;
      event.preventDefault();
      requestDeleteCohabitation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestDeleteCohabitation, selectedCohabitation, selectedLabel]);
  return {
    selectedCohabitation,
    setSelectedCohabitation,
    selectedLabel,
    setSelectedLabel,
    lassoMode: tool === "lasso",
    setLassoMode,
    labelMode: tool === "label",
    setLabelMode,
    announcement,
    setAnnouncement,
    requestDeleteCohabitation,
  };
}
