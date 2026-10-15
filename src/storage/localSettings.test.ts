import { describe, expect, it } from "vitest";
import type { GenderDefinition, RelationshipDefinition } from "../types";
import type { DefinitionsDocumentV1 } from "./defaults";
import { createMemoryStore } from "./kv";
import { createLocalApi } from "./localApi";
import { DEFINITIONS_KEY } from "./repository";

const relationshipInput: Omit<RelationshipDefinition, "id" | "usageCount"> = {
  name: "  続柄  ",
  kind: "other",
  direction: "right",
  lineStyle: "solid",
  lineColor: "#123abc",
  sortOrder: 7,
  active: true,
};
const genderInput: Omit<GenderDefinition, "id" | "usageCount"> = {
  name: "  性別  ",
  shape: "circle",
  fillColor: "#123abc",
  textColor: "#ffffff",
  sortOrder: 7,
  active: true,
};

async function setup() {
  const store = createMemoryStore();
  const api = createLocalApi(store);
  const relationship = await api.createRelationship(relationshipInput);
  const gender = await api.createGender(genderInput);
  return { api, store, relationship, gender };
}

describe("definition input normalization", () => {
  it("trims names on creation and retains explicit false and zero values", async () => {
    const api = createLocalApi(createMemoryStore());
    const relationship = await api.createRelationship({
      ...relationshipInput,
      active: false,
      sortOrder: 0,
    });
    const gender = await api.createGender({
      ...genderInput,
      active: false,
      sortOrder: 0,
    });
    expect(relationship).toMatchObject({
      name: "続柄",
      active: false,
      sortOrder: 0,
      usageCount: 0,
    });
    expect(gender).toMatchObject({
      name: "性別",
      active: false,
      sortOrder: 0,
      usageCount: 0,
    });
  });

  it("defaults omitted creation flags and sort order", async () => {
    const api = createLocalApi(createMemoryStore());
    const relationship = await api.createRelationship({
      ...relationshipInput,
      active: undefined,
      sortOrder: undefined,
    } as unknown as typeof relationshipInput);
    const gender = await api.createGender({
      ...genderInput,
      active: undefined,
      sortOrder: undefined,
    } as unknown as typeof genderInput);
    expect(relationship).toMatchObject({ active: true, sortOrder: 0 });
    expect(gender).toMatchObject({ active: true, sortOrder: 0 });
  });

  it("partial updates preserve omitted fields while accepting false and zero", async () => {
    const { api, relationship, gender } = await setup();
    expect(
      await api.updateRelationship(relationship.id, {
        name: "  変更  ",
        active: false,
        sortOrder: 0,
      }),
    ).toEqual({ ...relationship, name: "変更", active: false, sortOrder: 0 });
    expect(
      await api.updateGender(gender.id, {
        name: "  変更  ",
        active: false,
        sortOrder: 0,
      }),
    ).toEqual({ ...gender, name: "変更", active: false, sortOrder: 0 });
  });

  it("null patch fields retain existing values and invalid sort orders fall back", async () => {
    const { api, relationship, gender } = await setup();
    const relationshipPatch = Object.fromEntries(
      Object.keys(relationshipInput).map((key) => [key, null]),
    ) as Partial<RelationshipDefinition>;
    const genderPatch = Object.fromEntries(
      Object.keys(genderInput).map((key) => [key, null]),
    ) as Partial<GenderDefinition>;
    expect(
      await api.updateRelationship(relationship.id, relationshipPatch),
    ).toEqual(relationship);
    expect(await api.updateGender(gender.id, genderPatch)).toEqual(gender);
    expect(
      await api.updateRelationship(relationship.id, { sortOrder: NaN }),
    ).toEqual(relationship);
    expect(await api.updateGender(gender.id, { sortOrder: Infinity })).toEqual(
      gender,
    );
  });

  it.each(["create", "update"] as const)(
    "%s rejects invalid colors with the existing messages and leaves storage intact",
    async (operation) => {
      const { api, store, relationship, gender } = await setup();
      const before = await store.get(DEFINITIONS_KEY);
      await expect(
        operation === "create"
          ? api.createRelationship({ ...relationshipInput, lineColor: "red" })
          : api.updateRelationship(relationship.id, { lineColor: "red" }),
      ).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
        message: "続柄の設定を確認してください",
      });
      await expect(
        operation === "create"
          ? api.createGender({ ...genderInput, textColor: "red" })
          : api.updateGender(gender.id, { textColor: "red" }),
      ).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
        message: "性別の設定を確認してください",
      });
      expect(await store.get(DEFINITIONS_KEY)).toEqual(before);
    },
  );

  it.each(["", "x".repeat(41)])(
    "rejects invalid names on create and update (%s)",
    async (name) => {
      const { api, store, relationship, gender } = await setup();
      const before = await store.get(DEFINITIONS_KEY);
      const error = {
        code: "VALIDATION_ERROR",
        fields: { name: "1〜40文字で入力してください" },
      };
      await expect(
        api.createRelationship({ ...relationshipInput, name }),
      ).rejects.toMatchObject(error);
      await expect(
        api.updateRelationship(relationship.id, { name }),
      ).rejects.toMatchObject(error);
      await expect(
        api.createGender({ ...genderInput, name }),
      ).rejects.toMatchObject(error);
      await expect(api.updateGender(gender.id, { name })).rejects.toMatchObject(
        error,
      );
      expect(await store.get(DEFINITIONS_KEY)).toEqual(before);
    },
  );

  it("updates preserve unknown stored fields and cannot replace identity or inject usage counts", async () => {
    const { api, store, relationship, gender } = await setup();
    const definitions =
      (await store.get<DefinitionsDocumentV1>(DEFINITIONS_KEY))!;
    await store.set(DEFINITIONS_KEY, {
      ...definitions,
      relationships: definitions.relationships.map((item) =>
        item.id === relationship.id ? { ...item, future: "retained" } : item,
      ),
      genders: definitions.genders.map((item) =>
        item.id === gender.id ? { ...item, future: "retained" } : item,
      ),
    });
    expect(
      await api.updateRelationship(relationship.id, {
        id: "replacement",
        usageCount: 99,
      }),
    ).toMatchObject({ id: relationship.id, usageCount: 0, future: "retained" });
    expect(
      await api.updateGender(gender.id, { id: "replacement", usageCount: 99 }),
    ).toMatchObject({ id: gender.id, usageCount: 0, future: "retained" });
    const stored = (await store.get<DefinitionsDocumentV1>(DEFINITIONS_KEY))!;
    expect(
      stored.relationships.find((item) => item.id === relationship.id),
    ).not.toHaveProperty("usageCount");
    expect(
      stored.genders.find((item) => item.id === gender.id),
    ).not.toHaveProperty("usageCount");
  });
});
