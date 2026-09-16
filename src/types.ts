export type Shape = "circle" | "square" | "diamond";
export type RelationKind =
  "self" | "parent" | "child" | "partner" | "sibling" | "divorce" | "other";
export type Direction = "above" | "below" | "left" | "right";
export type LineStyle = "solid" | "dashed" | "dotted";
export interface GenderDefinition {
  id: string;
  name: string;
  shape: Shape;
  fillColor: string;
  textColor: string;
  sortOrder: number;
  active: boolean;
  usageCount?: number;
}
export interface RelationshipDefinition {
  id: string;
  name: string;
  kind: RelationKind;
  direction: Direction;
  lineStyle: LineStyle;
  lineColor: string;
  sortOrder: number;
  active: boolean;
  usageCount?: number;
}
export interface ChartSummary {
  id: string;
  title: string;
  nodeCount: number;
  updatedAt: string;
}
export interface ChartNodeRecord {
  id: string;
  relationshipId: string;
  genderId: string;
  anchorNodeId: string | null;
  parentNodeId1: string | null;
  parentNodeId2: string | null;
  placementDirection: Direction | null;
  connectionDirection: Direction | null;
  divorced: boolean;
  memo: string;
  fontSize: number;
  relationshipFontSize: number;
  scale: number;
  x: number;
  y: number;
}

export interface ChartNodeLayout {
  id: string;
  x: number;
  y: number;
  scale: number;
}
export interface ChartEdgeRecord {
  id: string;
  source: string;
  target: string;
  relationshipId: string;
  relationKind: RelationKind;
  lineStyle: LineStyle;
  lineColor: string;
}
export interface ChartDetail {
  id: string;
  title: string;
  nodes: ChartNodeRecord[];
  edges: ChartEdgeRecord[];
  relationships: RelationshipDefinition[];
  genders: GenderDefinition[];
  updatedAt: string;
}
