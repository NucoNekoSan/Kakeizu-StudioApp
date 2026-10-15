import { type FormEvent, useEffect, useRef, useState } from "react";
import type { ChartNodeRecord, Direction } from "../../types";
import type { NodeDraft } from "./editorPresets";
import {
  initialNodeFormValues,
  selectedNodeFormValues,
  nodeFormChoices,
  nodeFormSelection,
  buildNodeFormSubmission,
  type NodeFormContext,
  type NodeFormValues,
} from "./nodeFormModel";

export type NodeFormProps = NodeFormContext & {
  onSubmit(value: Omit<ChartNodeRecord, "id">): void;
  onDelete?(): void;
  onConnectionPreview?(direction: Direction | null): void;
  onDraftChange?(draft: NodeDraft | null): void;
  onChange?(input: Partial<Omit<ChartNodeRecord, "id">>): void;
};

export function useNodeForm(context: NodeFormProps) {
  const {
    mode,
    detail,
    value,
    onSubmit,
    onConnectionPreview,
    onDraftChange,
    onChange,
  } = context;
  const [values, setValues] = useState(() => initialNodeFormValues(context));
  const { parentNodeId1, divorced, memo, fontSize, relationshipFontSize } =
    values;
  const choices = nodeFormChoices(context);
  const selection = nodeFormSelection(context, values);
  const { suggestedParent2 } = selection;
  function setField<K extends keyof NodeFormValues>(
    key: K,
    next: NodeFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: next }));
  }
  const hydratedNodeId = useRef<string | null>(null);
  useEffect(() => {
    if (!value) {
      hydratedNodeId.current = null;
      return;
    }
    if (hydratedNodeId.current === value.id) return;
    hydratedNodeId.current = value.id;
    setValues(selectedNodeFormValues(value, detail.nodes));
  }, [value, detail.nodes]);
  const draftNodeId = value?.id;
  useEffect(
    () => () => {
      if (mode === "edit" && draftNodeId) onDraftChange?.(null);
    },
    [draftNodeId, mode, onDraftChange],
  );

  const changeAnchor = (next: string) => {
    setField("anchorNodeId", next);
    if (mode === "edit") onChange?.({ anchorNodeId: next });
  };
  const changeRelationship = (next: string) => {
    setField("relationshipId", next);
    if (mode === "edit") onChange?.({ relationshipId: next });
  };
  const changeGender = (next: string) => {
    setField("genderId", next);
    if (mode === "edit") onChange?.({ genderId: next });
  };
  const changeConnectionDirection = (input: string) => {
    const direction = (input || null) as Direction | null;
    setField("connectionDirection", direction);
    onConnectionPreview?.(direction);
    if (mode === "edit") onChange?.({ connectionDirection: direction });
  };
  const changeParent2 = (input: string) => {
    const next = input || null;
    setField("parentNodeId2", next);
    if (mode === "edit") onChange?.({ parentNodeId2: next });
  };
  const changeParent1 = (input: string) => {
    const next = input || null;
    setField("parentNodeId1", next);
    if (mode === "edit") onChange?.({ parentNodeId1: next });
  };

  const applySuggestedParent = () => {
    if (!suggestedParent2) return;
    setField("parentNodeId2", suggestedParent2.id);
    if (mode === "edit")
      onChange?.({
        parentNodeId1,
        parentNodeId2: suggestedParent2.id,
      });
  };
  const toggleDivorced = () => {
    const next = !divorced;
    setField("divorced", next);
    if (mode === "edit") onChange?.({ divorced: next });
  };
  const changeMemo = (nextMemo: string) => {
    setField("memo", nextMemo);
    if (mode === "edit" && draftNodeId) {
      onDraftChange?.({
        nodeId: draftNodeId,
        memo: nextMemo,
        fontSize,
        relationshipFontSize,
      });
      onChange?.({ memo: nextMemo.slice(0, 2000) });
    }
  };
  const changeFontSize = (nextFontSize: number) => {
    setField("fontSize", nextFontSize);
    if (mode === "edit" && draftNodeId)
      onChange?.({ fontSize: nextFontSize, relationshipFontSize });
    if (mode === "edit" && draftNodeId)
      onDraftChange?.({
        nodeId: draftNodeId,
        memo,
        fontSize: nextFontSize,
        relationshipFontSize,
      });
  };
  const changeRelationshipFontSize = (nextRelationshipFontSize: number) => {
    setField("relationshipFontSize", nextRelationshipFontSize);
    if (mode === "edit" && draftNodeId)
      onChange?.({
        fontSize,
        relationshipFontSize: nextRelationshipFontSize,
      });
    if (mode === "edit" && draftNodeId)
      onDraftChange?.({
        nodeId: draftNodeId,
        memo,
        fontSize,
        relationshipFontSize: nextRelationshipFontSize,
      });
  };
  const changePlacementDirection = (
    next: NodeFormValues["placementDirection"],
  ) => setField("placementDirection", next);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(buildNodeFormSubmission(context, values));
  };
  return {
    ...values,
    ...choices,
    ...selection,
    submit,
    changePlacementDirection,
    changeAnchor,
    changeRelationship,
    changeGender,
    changeConnectionDirection,
    changeParent2,
    changeParent1,
    applySuggestedParent,
    toggleDivorced,
    changeMemo,
    changeFontSize,
    changeRelationshipFontSize,
  };
}
