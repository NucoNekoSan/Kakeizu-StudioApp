import { useRef, type PointerEvent } from "react";
import type { Node } from "@xyflow/react";
import type { FamilyNodeData } from "../../familyGraph";
import {
  createCohabitationFromNodes,
  findNodeIdsInsidePolygon,
  type Cohabitation,
  type CohabitationLabel,
  type Point,
} from "./cohabitationModel";

interface CohabitationToolOverlayProps {
  lassoMode: boolean;
  labelMode: boolean;
  nodes: readonly Node<FamilyNodeData>[];
  screenToFlowPosition: (event: PointerEvent<Element>) => Point | undefined;
  onSetCohabitations: (
    update: (items: Cohabitation[]) => Cohabitation[],
  ) => void;
  onSetLabels: (
    update: (items: CohabitationLabel[]) => CohabitationLabel[],
  ) => void;
  onSelectCohabitation: (id: string | null) => void;
  onSelectLabel: (id: string | null) => void;
  onCreateCohabitation?: (group: Cohabitation) => void;
  onCreateLabel?: () => void;
  onFinishLasso: () => void;
  onFinishLabel: () => void;
}

export function CohabitationToolOverlay({
  lassoMode,
  labelMode,
  nodes,
  screenToFlowPosition,
  onSetCohabitations,
  onSetLabels,
  onSelectCohabitation,
  onSelectLabel,
  onCreateCohabitation,
  onCreateLabel,
  onFinishLasso,
  onFinishLabel,
}: CohabitationToolOverlayProps) {
  const lassoPoints = useRef<Point[]>([]);

  if (!lassoMode && !labelMode) return null;

  const finishLasso = () => {
    const nodeIds = findNodeIdsInsidePolygon(lassoPoints.current, nodes);
    const group = createCohabitationFromNodes(nodes, nodeIds);
    if (group) {
      onSetCohabitations((items) => [...items, group]);
      onSelectCohabitation(group.id);
      onSelectLabel(null);
      onCreateCohabitation?.(group);
    }
    lassoPoints.current = [];
    onFinishLasso();
  };

  return (
    <svg
      className="lasso-overlay"
      onPointerDown={(event) => {
        const point = screenToFlowPosition(event);
        if (!point) return;
        if (labelMode) {
          const next = {
            id: crypto.randomUUID(),
            x: point.x,
            y: point.y,
            fontSize: 20,
          };
          onSetLabels((items) => [...items, next]);
          onSelectLabel(next.id);
          onSelectCohabitation(null);
          onCreateLabel?.();
          onFinishLabel();
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        lassoPoints.current = [point];
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const point = screenToFlowPosition(event);
        if (!point) return;
        const previous = lassoPoints.current.at(-1);
        if (
          !previous ||
          Math.hypot(point.x - previous.x, point.y - previous.y) >= 4
        )
          lassoPoints.current.push(point);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        finishLasso();
      }}
      onPointerCancel={finishLasso}
    />
  );
}
