import { ApiError, validationError } from "../api/errors";
import type { GenderDefinition, RelationshipDefinition } from "../types";
import { createId } from "./ids";
import type { Repository } from "./repository";
import * as check from "./validation";

const RELATION_MESSAGE = "続柄の設定を確認してください";
const GENDER_MESSAGE = "性別の設定を確認してください";

export function createSettingsApi(repository: Repository) {
  /** 全チャート横断の使用数。PHP 版の相関サブクエリ相当。 */
  const usage = async () => {
    const documents = await repository.allCharts();
    const relationships = new Map<string, number>();
    const genders = new Map<string, number>();
    for (const document of documents)
      for (const node of document.nodes) {
        relationships.set(
          node.relationshipId,
          (relationships.get(node.relationshipId) ?? 0) + 1,
        );
        genders.set(node.genderId, (genders.get(node.genderId) ?? 0) + 1);
      }
    return { relationships, genders };
  };

  const bySortOrder = <T extends { sortOrder: number; name: string }>(
    a: T,
    b: T,
  ) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ja");

  return {
    relationships: async (): Promise<RelationshipDefinition[]> => {
      const [definitions, counts] = await Promise.all([
        repository.definitions(),
        usage(),
      ]);
      return [...definitions.relationships].sort(bySortOrder).map((item) => ({
        ...item,
        usageCount: counts.relationships.get(item.id) ?? 0,
      }));
    },

    createRelationship: async (
      input: Omit<RelationshipDefinition, "id" | "usageCount">,
    ): Promise<RelationshipDefinition> => {
      const definitions = await repository.definitions();
      const created: RelationshipDefinition = {
        id: createId(),
        name: check.text(input.name, "name", check.DEFINITION_NAME_MAX),
        kind: check.oneOf(input.kind, check.RELATION_KINDS, RELATION_MESSAGE),
        direction: check.oneOf(
          input.direction,
          check.DIRECTIONS,
          RELATION_MESSAGE,
        ),
        lineStyle: check.oneOf(
          input.lineStyle,
          check.LINE_STYLES,
          RELATION_MESSAGE,
        ),
        lineColor: check.color(input.lineColor, RELATION_MESSAGE),
        sortOrder: check.sortOrder(input.sortOrder, 0),
        active: input.active ?? true,
      };
      await repository.saveDefinitions({
        ...definitions,
        relationships: [...definitions.relationships, created],
      });
      return { ...created, usageCount: 0 };
    },

    updateRelationship: async (
      id: string,
      input: Partial<RelationshipDefinition>,
    ): Promise<RelationshipDefinition> => {
      const definitions = await repository.definitions();
      const previous = definitions.relationships.find((item) => item.id === id);
      if (!previous) throw validationError("続柄を選び直してください");
      const updated: RelationshipDefinition = {
        ...previous,
        name: check.text(
          input.name ?? previous.name,
          "name",
          check.DEFINITION_NAME_MAX,
        ),
        kind: check.oneOf(
          input.kind ?? previous.kind,
          check.RELATION_KINDS,
          RELATION_MESSAGE,
        ),
        direction: check.oneOf(
          input.direction ?? previous.direction,
          check.DIRECTIONS,
          RELATION_MESSAGE,
        ),
        lineStyle: check.oneOf(
          input.lineStyle ?? previous.lineStyle,
          check.LINE_STYLES,
          RELATION_MESSAGE,
        ),
        lineColor: check.color(
          input.lineColor ?? previous.lineColor,
          RELATION_MESSAGE,
        ),
        sortOrder: check.sortOrder(input.sortOrder, previous.sortOrder),
        active: input.active ?? previous.active,
      };
      await repository.saveDefinitions({
        ...definitions,
        relationships: definitions.relationships.map((item) =>
          item.id === id ? updated : item,
        ),
      });
      const counts = await usage();
      return { ...updated, usageCount: counts.relationships.get(id) ?? 0 };
    },

    deleteRelationship: async (id: string): Promise<void> => {
      const definitions = await repository.definitions();
      if (!definitions.relationships.some((item) => item.id === id))
        throw validationError("続柄を選び直してください");
      const counts = await usage();
      if ((counts.relationships.get(id) ?? 0) > 0)
        throw new ApiError(
          409,
          "MASTER_IN_USE",
          "使用中の続柄は削除できません",
        );
      await repository.saveDefinitions({
        ...definitions,
        relationships: definitions.relationships.filter(
          (item) => item.id !== id,
        ),
      });
    },

    genders: async (): Promise<GenderDefinition[]> => {
      const [definitions, counts] = await Promise.all([
        repository.definitions(),
        usage(),
      ]);
      return [...definitions.genders].sort(bySortOrder).map((item) => ({
        ...item,
        usageCount: counts.genders.get(item.id) ?? 0,
      }));
    },

    createGender: async (
      input: Omit<GenderDefinition, "id" | "usageCount">,
    ): Promise<GenderDefinition> => {
      const definitions = await repository.definitions();
      const created: GenderDefinition = {
        id: createId(),
        name: check.text(input.name, "name", check.DEFINITION_NAME_MAX),
        shape: check.oneOf(input.shape, check.SHAPES, GENDER_MESSAGE),
        fillColor: check.color(input.fillColor, GENDER_MESSAGE),
        textColor: check.color(input.textColor, GENDER_MESSAGE),
        sortOrder: check.sortOrder(input.sortOrder, 0),
        active: input.active ?? true,
      };
      await repository.saveDefinitions({
        ...definitions,
        genders: [...definitions.genders, created],
      });
      return { ...created, usageCount: 0 };
    },

    updateGender: async (
      id: string,
      input: Partial<GenderDefinition>,
    ): Promise<GenderDefinition> => {
      const definitions = await repository.definitions();
      const previous = definitions.genders.find((item) => item.id === id);
      if (!previous) throw validationError("性別を選び直してください");
      const updated: GenderDefinition = {
        ...previous,
        name: check.text(
          input.name ?? previous.name,
          "name",
          check.DEFINITION_NAME_MAX,
        ),
        shape: check.oneOf(
          input.shape ?? previous.shape,
          check.SHAPES,
          GENDER_MESSAGE,
        ),
        fillColor: check.color(
          input.fillColor ?? previous.fillColor,
          GENDER_MESSAGE,
        ),
        textColor: check.color(
          input.textColor ?? previous.textColor,
          GENDER_MESSAGE,
        ),
        sortOrder: check.sortOrder(input.sortOrder, previous.sortOrder),
        active: input.active ?? previous.active,
      };
      await repository.saveDefinitions({
        ...definitions,
        genders: definitions.genders.map((item) =>
          item.id === id ? updated : item,
        ),
      });
      const counts = await usage();
      return { ...updated, usageCount: counts.genders.get(id) ?? 0 };
    },

    deleteGender: async (id: string): Promise<void> => {
      const definitions = await repository.definitions();
      if (!definitions.genders.some((item) => item.id === id))
        throw validationError("性別を選び直してください");
      const counts = await usage();
      if ((counts.genders.get(id) ?? 0) > 0)
        throw new ApiError(
          409,
          "MASTER_IN_USE",
          "使用中の性別は削除できません",
        );
      await repository.saveDefinitions({
        ...definitions,
        genders: definitions.genders.filter((item) => item.id !== id),
      });
    },
  };
}
