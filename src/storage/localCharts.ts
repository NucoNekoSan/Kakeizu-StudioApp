import { isFrameHeight, isFrameWidth } from "../frameSettings";
import { validationError } from "../api/errors";
import type {
  ChartDetail,
  ChartNodeLayout,
  ChartNodeRecord,
  ChartSummary,
  Direction,
  RelationshipDefinition,
} from "../types";
import {
  deriveEdge,
  removeNode,
  toChartDetail,
  withoutEdgeBetween,
  type ChartDocumentV1,
} from "./chartDocument";
import { createChartDocument } from "./chartDocument";
import { createId, isId } from "./ids";
import type { Repository } from "./repository";
import * as check from "./validation";

const summary = (document: ChartDocumentV1): ChartSummary => ({
  id: document.id,
  title: document.title,
  nodeCount: document.nodes.length,
  updatedAt: document.updatedAt,
});

const relationshipOf = (
  relationships: RelationshipDefinition[],
  id: unknown,
): RelationshipDefinition => {
  const found = relationships.find((item) => item.id === id);
  if (!found) throw validationError("続柄を選び直してください");
  return found;
};

const assertGender = (genderIds: Set<string>, id: unknown): string => {
  if (typeof id !== "string" || !genderIds.has(id))
    throw validationError("性別を選び直してください");
  return id;
};

/** 同一チャート内の既存ノードを指しているか (PHP 版 nodeRef の移植)。 */
function nodeRef(
  value: unknown,
  document: ChartDocumentV1,
  currentId: string,
  field: string,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string")
    throw validationError("同じ相関図のノードを選択してください", {
      [field]: "選択し直してください",
    });
  if (value === currentId)
    throw validationError("自身は選択できません", {
      [field]: "別のノードを選択してください",
    });
  if (!document.nodes.some((node) => node.id === value))
    throw validationError("同じ相関図のノードを選択してください", {
      [field]: "選択し直してください",
    });
  return value;
}

/** 親ペア規則: 親2だけの指定は不可、親1 と親2 は別人 (PHP 版 familyRefs)。 */
function familyRefs(
  input: Record<string, unknown>,
  document: ChartDocumentV1,
  currentId: string,
  previous?: ChartNodeRecord,
): [string | null, string | null, Direction | null] {
  const pick = (key: string, fallback: string | null) =>
    key in input ? (input[key] as string | null) || null : fallback;
  const parent1 = pick("parentNodeId1", previous?.parentNodeId1 ?? null);
  const parent2 = pick("parentNodeId2", previous?.parentNodeId2 ?? null);
  if (!parent1 && parent2)
    throw validationError("親2を指定する場合は親1も選択してください");
  if (parent1 && parent1 === parent2)
    throw validationError("異なる2名の親を選択してください");
  const rawDirection =
    "placementDirection" in input
      ? (input.placementDirection as string | null) || null
      : (previous?.placementDirection ?? null);
  const placement =
    rawDirection === null
      ? null
      : check.oneOf(
          rawDirection,
          check.DIRECTIONS,
          "配置方向を選び直してください",
        );
  return [
    nodeRef(parent1, document, currentId, "parentNodeId1"),
    nodeRef(parent2, document, currentId, "parentNodeId2"),
    placement,
  ];
}

function connectionDirection(
  input: Record<string, unknown>,
  previous?: ChartNodeRecord,
): Direction | null {
  const raw =
    "connectionDirection" in input
      ? (input.connectionDirection as string | null) || null
      : (previous?.connectionDirection ?? null);
  if (raw === null) return null;
  return check.oneOf(raw, check.DIRECTIONS, "線の接続方向を選び直してください");
}

export function createChartApi(repository: Repository) {
  const detail = async (document: ChartDocumentV1): Promise<ChartDetail> => {
    const definitions = await repository.definitions();
    return toChartDetail(
      document,
      definitions.relationships,
      definitions.genders,
    );
  };

  return {
    charts: async (): Promise<ChartSummary[]> => {
      const documents = await repository.allCharts();
      return documents
        .map(summary)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    chart: async (id: string): Promise<ChartDetail> =>
      detail(await repository.chart(id)),

    createChart: async (title: string): Promise<ChartSummary> => {
      const document = createChartDocument(
        check.text(title, "title", check.TITLE_MAX),
      );
      return summary(await repository.saveChart(document));
    },

    updateChart: async (id: string, title: string): Promise<ChartSummary> => {
      const document = await repository.chart(id);
      const saved = await repository.saveChart({
        ...document,
        title: check.text(title, "title", check.TITLE_MAX),
      });
      return summary(saved);
    },

    deleteChart: async (id: string): Promise<void> => {
      await repository.chart(id);
      await repository.deleteChart(id);
    },

    createNode: async (
      chartId: string,
      input: Omit<ChartNodeRecord, "id">,
    ): Promise<ChartDetail> => {
      const document = await repository.chart(chartId);
      const definitions = await repository.definitions();
      const values = input as unknown as Record<string, unknown>;
      const relationship = relationshipOf(
        definitions.relationships,
        values.relationshipId,
      );
      const genderId = assertGender(
        new Set(definitions.genders.map((item) => item.id)),
        values.genderId,
      );
      const nodeId = createId();
      const anchorNodeId = nodeRef(
        values.anchorNodeId,
        document,
        nodeId,
        "anchorNodeId",
      );
      const [parentNodeId1, parentNodeId2, placementDirection] = familyRefs(
        values,
        document,
        nodeId,
      );
      const node: ChartNodeRecord = {
        id: nodeId,
        relationshipId: relationship.id,
        genderId,
        anchorNodeId,
        parentNodeId1,
        parentNodeId2,
        placementDirection,
        connectionDirection: connectionDirection(values),
        divorced: check.boolValue(values.divorced ?? false),
        memo: check.clampMemo(values.memo ?? ""),
        fontSize: check.fontSize(values.fontSize ?? 16, "メモ"),
        relationshipFontSize: check.fontSize(
          values.relationshipFontSize ?? 17,
          "続柄",
        ),
        scale: check.scale(values.scale ?? 1),
        x: check.coordinate(values.x ?? 240),
        y: check.coordinate(values.y ?? 180),
      };
      const edge = deriveEdge(nodeId, anchorNodeId, relationship);
      const saved = await repository.saveChart({
        ...document,
        nodes: [...document.nodes, node],
        edges: edge ? [...document.edges, edge] : document.edges,
      });
      return detail(saved);
    },

    updateNode: async (
      chartId: string,
      nodeId: string,
      input: Partial<Omit<ChartNodeRecord, "id">>,
    ): Promise<ChartDetail> => {
      const document = await repository.chart(chartId);
      const previous = document.nodes.find((node) => node.id === nodeId);
      if (!previous) throw validationError("ノードが見つかりません");
      const definitions = await repository.definitions();
      const values = input as unknown as Record<string, unknown>;
      const relationship = relationshipOf(
        definitions.relationships,
        values.relationshipId ?? previous.relationshipId,
      );
      const genderId = assertGender(
        new Set(definitions.genders.map((item) => item.id)),
        values.genderId ?? previous.genderId,
      );
      const anchorNodeId = nodeRef(
        "anchorNodeId" in values ? values.anchorNodeId : previous.anchorNodeId,
        document,
        nodeId,
        "anchorNodeId",
      );
      const [parentNodeId1, parentNodeId2, placementDirection] = familyRefs(
        values,
        document,
        nodeId,
        previous,
      );
      const node: ChartNodeRecord = {
        ...previous,
        relationshipId: relationship.id,
        genderId,
        anchorNodeId,
        parentNodeId1,
        parentNodeId2,
        placementDirection,
        connectionDirection: connectionDirection(values, previous),
        divorced:
          "divorced" in values
            ? check.boolValue(values.divorced)
            : previous.divorced,
        memo: check.clampMemo(values.memo ?? previous.memo),
        fontSize: check.fontSize(values.fontSize ?? previous.fontSize, "メモ"),
        relationshipFontSize: check.fontSize(
          values.relationshipFontSize ?? previous.relationshipFontSize,
          "続柄",
        ),
        scale: check.scale(values.scale ?? previous.scale),
        x: check.coordinate(values.x ?? previous.x),
        y: check.coordinate(values.y ?? previous.y),
      };
      // 旧アンカーとの既存エッジを外してから、新しい関係で1本引き直す。
      const remaining = withoutEdgeBetween(
        document.edges,
        nodeId,
        previous.anchorNodeId,
      );
      const edge = deriveEdge(nodeId, anchorNodeId, relationship);
      const saved = await repository.saveChart({
        ...document,
        nodes: document.nodes.map((item) => (item.id === nodeId ? node : item)),
        edges: edge ? [...remaining, edge] : remaining,
      });
      return detail(saved);
    },

    deleteNode: async (
      chartId: string,
      nodeId: string,
    ): Promise<ChartDetail> => {
      const document = await repository.chart(chartId);
      if (!document.nodes.some((node) => node.id === nodeId))
        throw validationError("ノードが見つかりません");
      const saved = await repository.saveChart(removeNode(document, nodeId));
      return detail(saved);
    },

    updateNodeLayout: async (
      chartId: string,
      nodes: ChartNodeLayout[],
      frameWidth?: number,
      frameHeight?: number,
    ): Promise<ChartDetail> => {
      if (frameWidth !== undefined && !isFrameWidth(frameWidth))
        throw validationError("横幅は1200〜4800pxの整数で指定してください");
      if (frameHeight !== undefined && !isFrameHeight(frameHeight))
        throw validationError("縦幅は600〜4800pxの整数で指定してください");
      const document = await repository.chart(chartId);
      if (!Array.isArray(nodes) || nodes.length > check.LAYOUT_NODES_MAX)
        throw validationError("レイアウト情報を確認してください");
      const seen = new Set<string>();
      const updates = new Map<string, ChartNodeLayout>();
      for (const item of nodes) {
        const id = (item as { id?: unknown })?.id;
        if (!isId(id) || seen.has(id))
          throw validationError("ノードIDを確認してください");
        if (!document.nodes.some((node) => node.id === id))
          throw validationError("同じ相関図のノードを選択してください");
        seen.add(id);
        updates.set(id, {
          id,
          x: check.coordinate(item.x),
          y: check.coordinate(item.y),
          scale: check.scale(item.scale),
        });
      }
      const saved = await repository.saveChart({
        ...document,
        ...(frameWidth === undefined ? {} : { frameWidth }),
        ...(frameHeight === undefined ? {} : { frameHeight }),
        nodes: document.nodes.map((node) => {
          const update = updates.get(node.id);
          return update
            ? { ...node, x: update.x, y: update.y, scale: update.scale }
            : node;
        }),
      });
      return detail(saved);
    },
  };
}
