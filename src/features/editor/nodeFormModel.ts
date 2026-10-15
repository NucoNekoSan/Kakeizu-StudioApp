import type { Node } from "@xyflow/react";
import type { ChartDetail, ChartNodeRecord } from "../../types";
import type { FamilyNodeData } from "../../familyGraph";
import { findFreePosition } from "../../placement";
import {
  findPartnerIds,
  quickDirection,
  type AddPreset,
} from "./editorPresets";

export type NodeFormContext = {
  mode: "add" | "edit";
  detail: ChartDetail;
  nodes: Node<FamilyNodeData>[];
  value?: Node<FamilyNodeData> | null;
  preset?: AddPreset | null;
};
export type NodeFormValues = Pick<
  ChartNodeRecord,
  | "relationshipId"
  | "genderId"
  | "anchorNodeId"
  | "parentNodeId1"
  | "parentNodeId2"
  | "connectionDirection"
  | "divorced"
  | "memo"
  | "fontSize"
  | "relationshipFontSize"
> & { placementDirection: NonNullable<ChartNodeRecord["placementDirection"]> };

export function nodeFormChoices({
  detail,
  nodes,
  value,
  preset,
}: NodeFormContext) {
  const presetKinds =
    preset?.kind === "partner"
      ? ["partner", "divorce"]
      : preset
        ? [preset.kind]
        : null;
  return {
    activeR: detail.relationships.filter(
      (v) =>
        (v.active || v.id === value?.data.relationshipId) &&
        (!presetKinds || presetKinds.includes(v.kind)),
    ),
    activeG: detail.genders.filter(
      (v) => v.active || v.id === value?.data.genderId,
    ),
    presetAnchor: nodes.find((node) => node.id === preset?.anchorId),
    partnerIds: findPartnerIds(preset?.anchorId, nodes),
    options: nodes.filter((node) => node.id !== value?.id),
  };
}

export function initialNodeFormValues(
  context: NodeFormContext,
): NodeFormValues {
  const { detail, nodes, value, preset } = context;
  const { activeR, activeG, presetAnchor, partnerIds } =
    nodeFormChoices(context);
  const record = value
    ? detail.nodes.find((n) => n.id === value.id)
    : undefined;
  return {
    relationshipId: value?.data.relationshipId || activeR[0]?.id || "",
    genderId: value?.data.genderId || activeG[0]?.id || "",
    anchorNodeId:
      record?.anchorNodeId || preset?.anchorId || nodes[0]?.id || null,
    parentNodeId1:
      record?.parentNodeId1 ||
      (preset?.kind === "child" ? preset.anchorId : null) ||
      (preset?.kind === "sibling"
        ? presetAnchor?.data.parentNodeId1 || null
        : null),
    parentNodeId2:
      record?.parentNodeId2 ||
      (preset?.kind === "child" && partnerIds.length === 1
        ? partnerIds[0]
        : preset?.kind === "sibling"
          ? presetAnchor?.data.parentNodeId2 || null
          : null),
    placementDirection:
      record?.placementDirection || quickDirection(preset, nodes),
    connectionDirection: record?.connectionDirection || null,
    divorced: record?.divorced || false,
    memo: value?.data.memo || "",
    fontSize: value?.data.fontSize || 16,
    relationshipFontSize: value?.data.relationshipFontSize || 17,
  };
}

/** Refresh only when the selected person changes, never on a save response. */
export function selectedNodeFormValues(
  value: Node<FamilyNodeData>,
  records: ChartNodeRecord[],
): NodeFormValues {
  const record = records.find((n) => n.id === value.id);
  return {
    relationshipId: value.data.relationshipId,
    genderId: value.data.genderId,
    memo: value.data.memo,
    fontSize: value.data.fontSize,
    relationshipFontSize: value.data.relationshipFontSize,
    anchorNodeId: record?.anchorNodeId || null,
    parentNodeId1: record?.parentNodeId1 || null,
    parentNodeId2: record?.parentNodeId2 || null,
    placementDirection: record?.placementDirection || "right",
    connectionDirection: record?.connectionDirection || null,
    divorced: record?.divorced || false,
  };
}

export function nodeFormSelection(
  context: NodeFormContext,
  values: NodeFormValues,
) {
  const { mode, detail, nodes } = context;
  const { relationshipId, parentNodeId1, parentNodeId2 } = values;
  const selectedRelation = detail.relationships.find(
    (r) => r.id === relationshipId,
  );
  const parentPartnerIds = findPartnerIds(parentNodeId1, nodes);
  return {
    selectedRelation,
    pairValid: !parentNodeId2 || parentNodeId1 !== parentNodeId2,
    hasParentPair: !!(parentNodeId1 && parentNodeId2),
    suggestedParent2:
      mode === "edit" &&
      selectedRelation?.kind === "child" &&
      parentNodeId1 &&
      !parentNodeId2 &&
      parentPartnerIds.length === 1
        ? nodes.find((n) => n.id === parentPartnerIds[0])
        : undefined,
  };
}

export function buildNodeFormSubmission(
  context: NodeFormContext,
  values: NodeFormValues,
): Omit<ChartNodeRecord, "id"> {
  const { mode, nodes, value } = context;
  const {
    relationshipId,
    genderId,
    anchorNodeId,
    parentNodeId1,
    parentNodeId2,
    placementDirection,
    connectionDirection,
    divorced,
    memo,
    fontSize,
    relationshipFontSize,
  } = values;
  const { selectedRelation } = nodeFormSelection(context, values);
  const anchor = nodes.find((n) => n.id === anchorNodeId),
    base = anchor?.position || value?.position || { x: 240, y: 180 },
    placed =
      mode === "add"
        ? selectedRelation?.kind === "self"
          ? { x: 0, y: 0 }
          : findFreePosition(
              base,
              placementDirection,
              nodes.filter((n) => n.id !== value?.id).map((n) => n.position),
            )
        : value?.position || base;

  return {
    relationshipId,
    genderId,
    anchorNodeId: nodes.length ? anchorNodeId : null,
    parentNodeId1,
    parentNodeId2,
    placementDirection,
    connectionDirection,
    divorced,
    memo: memo.slice(0, 2000),
    fontSize,
    relationshipFontSize,
    scale: value?.data.scale || 1,
    x: placed.x,
    y: placed.y,
  };
}
