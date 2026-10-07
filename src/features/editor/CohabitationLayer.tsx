import { useCallback, useEffect, useRef, type SetStateAction } from "react";
import { ViewportPortal, type Node } from "@xyflow/react";
import type { FamilyNodeData } from "../../familyGraph";
import type {
  Cohabitation,
  CohabitationLabel,
  Point,
} from "./cohabitationModel";

interface CohabitationLayerProps {
  groups: Cohabitation[];
  labels: CohabitationLabel[];
  nodesById: ReadonlyMap<string, Node<FamilyNodeData>>;
  selectedGroupId: string | null;
  selectedLabelId: string | null;
  screenToFlowPosition: (position: Point) => Point | undefined;
  onSetGroups: (update: SetStateAction<Cohabitation[]>) => void;
  onSetLabels: (update: SetStateAction<CohabitationLabel[]>) => void;
  onSelectGroup: (id: string | null) => void;
  onSelectLabel: (id: string | null) => void;
}

type GroupDrag = {
  id: string;
  handle: string;
  pointerId: number;
  start: Point;
  box: { cx: number; cy: number; rx: number; ry: number };
};
type LabelDrag = {
  id: string;
  pointerId: number;
  start: Point;
  origin: Point;
};
type PendingMove = Point & { pointerId: number; buttons: number };

export function CohabitationLayer({
  groups,
  labels,
  nodesById,
  selectedGroupId,
  selectedLabelId,
  screenToFlowPosition,
  onSetGroups,
  onSetLabels,
  onSelectGroup,
  onSelectLabel,
}: CohabitationLayerProps) {
  const groupDrag = useRef<GroupDrag | null>(null);
  const labelDrag = useRef<LabelDrag | null>(null);
  const pendingMove = useRef<PendingMove | null>(null);
  const animationFrame = useRef<number | null>(null);

  const applyPendingMove = useCallback(() => {
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    const move = pendingMove.current;
    pendingMove.current = null;
    if (!move) return;
    const point = screenToFlowPosition(move);
    if (!point) return;

    const textDrag = labelDrag.current;
    if (textDrag) {
      if (textDrag.pointerId !== move.pointerId || move.buttons === 0) {
        labelDrag.current = null;
        return;
      }
      onSetLabels((items) =>
        items.map((item) =>
          item.id === textDrag.id
            ? {
                ...item,
                x: textDrag.origin.x + point.x - textDrag.start.x,
                y: textDrag.origin.y + point.y - textDrag.start.y,
              }
            : item,
        ),
      );
      return;
    }

    const drag = groupDrag.current;
    if (!drag) return;
    if (drag.pointerId !== move.pointerId) {
      groupDrag.current = null;
      return;
    }
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    onSetGroups((items) =>
      items.map((item) => {
        if (item.id !== drag.id) return item;
        const box = drag.box;
        if (drag.handle === "label") {
          const rawX = (item.labelX ?? box.cx) + dx;
          const rawY = (item.labelY ?? box.cy) + dy;
          return {
            ...item,
            labelX: Math.min(
              box.cx + box.rx - 12,
              Math.max(
                box.cx - box.rx + 12,
                Number.isFinite(rawX) ? rawX : box.cx,
              ),
            ),
            labelY: Math.min(
              box.cy + box.ry - 12,
              Math.max(
                box.cy - box.ry + 12,
                Number.isFinite(rawY) ? rawY : box.cy,
              ),
            ),
          };
        }
        if (drag.handle === "move")
          return { ...item, cx: box.cx + dx, cy: box.cy + dy };
        const east = drag.handle.includes("e");
        const west = drag.handle.includes("w");
        const south = drag.handle.includes("s");
        const north = drag.handle.includes("n");
        const axisScale = (east || west) && (north || south) ? Math.SQRT1_2 : 1;
        return {
          ...item,
          cx: east || west ? box.cx + (east ? dx : -dx) / 2 : box.cx,
          cy: south || north ? box.cy + (south ? dy : -dy) / 2 : box.cy,
          rx: Math.max(
            30,
            box.rx + (east ? dx : west ? -dx : 0) / (2 * axisScale),
          ),
          ry: Math.max(
            30,
            box.ry + (south ? dy : north ? -dy : 0) / (2 * axisScale),
          ),
        };
      }),
    );
  }, [onSetGroups, onSetLabels, screenToFlowPosition]);

  const releaseDrag = useCallback(() => {
    applyPendingMove();
    groupDrag.current = null;
    labelDrag.current = null;
  }, [applyPendingMove]);

  useEffect(() => {
    window.addEventListener("pointerup", releaseDrag, true);
    window.addEventListener("pointercancel", releaseDrag, true);
    window.addEventListener("blur", releaseDrag);
    return () => {
      window.removeEventListener("pointerup", releaseDrag, true);
      window.removeEventListener("pointercancel", releaseDrag, true);
      window.removeEventListener("blur", releaseDrag);
      if (animationFrame.current !== null)
        cancelAnimationFrame(animationFrame.current);
    };
  }, [releaseDrag]);

  const beginGroupDrag = (
    event: React.PointerEvent<SVGElement>,
    group: Cohabitation,
    handle: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    onSelectGroup(group.id);
    const start = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    if (start)
      groupDrag.current = {
        id: group.id,
        handle,
        pointerId: event.pointerId,
        start,
        box: { cx: group.cx, cy: group.cy, rx: group.rx, ry: group.ry },
      };
  };

  return (
    <ViewportPortal>
      <svg
        className="cohabitation-layer"
        aria-hidden="true"
        width="100%"
        height="100%"
        onPointerMove={(event) => {
          event.stopPropagation();
          pendingMove.current = {
            x: event.clientX,
            y: event.clientY,
            pointerId: event.pointerId,
            buttons: event.buttons,
          };
          if (animationFrame.current === null)
            animationFrame.current = requestAnimationFrame(applyPendingMove);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          applyPendingMove();
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          groupDrag.current = null;
          labelDrag.current = null;
        }}
        onPointerCancel={releaseDrag}
      >
        {groups.map((group) => {
          const members = group.nodeIds.flatMap((id) =>
            nodesById.has(id) ? [id] : [],
          );
          if (members.length < 1) return null;
          const { cx, cy, rx, ry } = group;
          const d = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
          return (
            <g
              key={group.id}
              className={`cohabitation-group ${selectedGroupId === group.id ? "selected" : ""}`}
              onPointerDown={(event) => beginGroupDrag(event, group, "move")}
            >
              <path
                className="cohabitation-hit-area"
                d={d}
                fill="none"
                style={{
                  stroke: "transparent",
                  strokeWidth: 24,
                  pointerEvents: "stroke",
                  cursor: "move",
                }}
                onPointerDown={(event) => beginGroupDrag(event, group, "move")}
              />
              <path
                d={d}
                fill="none"
                stroke="#52645e"
                strokeWidth={selectedGroupId === group.id ? 4 : 3}
                strokeDasharray="12 8"
                strokeLinecap="butt"
                style={{ pointerEvents: "none" }}
              />
              {selectedGroupId === group.id &&
                (["e", "w", "n", "s", "ne", "nw", "se", "sw"] as const).map(
                  (handle) => {
                    const scale = handle.length === 2 ? Math.SQRT1_2 : 1;
                    const x = handle.includes("e")
                      ? cx + rx * scale
                      : handle.includes("w")
                        ? cx - rx * scale
                        : cx;
                    const y = handle.includes("s")
                      ? cy + ry * scale
                      : handle.includes("n")
                        ? cy - ry * scale
                        : cy;
                    return (
                      <circle
                        key={handle}
                        className="cohabitation-handle"
                        cx={x}
                        cy={y}
                        r="9"
                        onPointerDown={(event) =>
                          beginGroupDrag(event, group, handle)
                        }
                      />
                    );
                  },
                )}
            </g>
          );
        })}
        {labels.map((label) => (
          <text
            key={label.id}
            className={`cohabitation-label ${selectedLabelId === label.id ? "selected" : ""}`}
            x={label.x}
            y={label.y}
            fontSize={label.fontSize}
            fill="#263b34"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelectLabel(label.id);
              onSelectGroup(null);
              event.currentTarget.ownerSVGElement?.setPointerCapture(
                event.pointerId,
              );
              const start = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
              });
              if (start)
                labelDrag.current = {
                  id: label.id,
                  pointerId: event.pointerId,
                  start,
                  origin: { x: label.x, y: label.y },
                };
            }}
          >
            同居
          </text>
        ))}
      </svg>
    </ViewportPortal>
  );
}
