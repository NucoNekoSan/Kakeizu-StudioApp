import { describe, expect, it } from "vitest";
import { seedDefinitions } from "./defaults";
import {
  DIRECTIONS,
  LINE_STYLES,
  RELATION_KINDS,
  SHAPES,
  DEFINITION_NAME_MAX,
} from "./validation";

const definitions = seedDefinitions();

describe("既定の続柄", () => {
  it("名称が重複しない", () => {
    const names = definitions.relationships.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("sortOrder が重複しない", () => {
    const orders = definitions.relationships.map((item) => item.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("すべてバリデーション規則を満たす", () => {
    for (const item of definitions.relationships) {
      expect(RELATION_KINDS).toContain(item.kind);
      expect(DIRECTIONS).toContain(item.direction);
      expect(LINE_STYLES).toContain(item.lineStyle);
      expect(item.lineColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(item.name.length).toBeGreaterThan(0);
      expect([...item.name].length).toBeLessThanOrEqual(DEFINITION_NAME_MAX);
    }
  });

  it("基準となる本人はちょうど1件", () => {
    const selves = definitions.relationships.filter(
      (item) => item.kind === "self",
    );
    expect(selves).toHaveLength(1);
    expect(selves[0].name).toBe("本人");
  });

  it("クイック追加の各 kind に有効な選択肢がある", () => {
    // NodeForm はプリセットの kind で続柄を絞り込むため、
    // 各 kind に active な定義が最低1件ないとクイック追加が空になる。
    for (const kind of ["parent", "child", "sibling", "partner"] as const) {
      const available = definitions.relationships.filter(
        (item) => item.kind === kind && item.active,
      );
      expect(available.length).toBeGreaterThan(0);
    }
  });

  it("三親等程度までの続柄を既定で用意する", () => {
    const names = definitions.relationships.map((item) => item.name);
    for (const expected of [
      "祖父",
      "祖母",
      "孫",
      "義父",
      "義母",
      "義兄",
      "養子",
      "養父",
      "伯父・叔父",
      "甥",
      "姪",
      "いとこ",
      "内縁・事実婚",
      "別居",
    ])
      expect(names).toContain(expected);
  });

  it("使用頻度の低い続柄は既定で非表示にする", () => {
    const inactive = definitions.relationships
      .filter((item) => !item.active)
      .map((item) => item.name);
    expect(inactive).toContain("曽祖父");
    expect(inactive).toContain("里親");
    expect(inactive).toContain("支援者");
  });

  it("非血縁の関係は実線以外で描き分ける", () => {
    const style = (name: string) =>
      definitions.relationships.find((item) => item.name === name)?.lineStyle;
    expect(style("父")).toBe("solid");
    expect(style("義父")).toBe("dashed");
    expect(style("養子")).toBe("dashed");
    expect(style("内縁・事実婚")).toBe("dashed");
    expect(style("婚約者")).toBe("dotted");
    expect(style("支援者")).toBe("dotted");
  });
});

describe("既定の性別", () => {
  it("すべてバリデーション規則を満たす", () => {
    for (const item of definitions.genders) {
      expect(SHAPES).toContain(item.shape);
      expect(item.fillColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(item.textColor).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
