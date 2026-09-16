import { describe, expect, it } from "vitest";
import { legalDocuments } from "./legalContent";
import {
  hasUnsetPublisherFields,
  isPlaceholder,
  publisher,
  PUBLISHER_PLACEHOLDER,
  unsetPublisherFields,
} from "./publisher";

const documents = Object.values(legalDocuments);
const allText = documents
  .flatMap((document) => [
    document.title,
    document.lead,
    ...document.sections.flatMap((section) => [
      section.heading,
      ...(section.paragraphs ?? []),
      ...(section.list ?? []),
    ]),
  ])
  .join("\n");

describe("法的文書", () => {
  it("外部サイトのURLを含まない", () => {
    // 外部リンクを置くと「自オリジン以外への通信ゼロ」の説明が崩れる
    expect(allText).not.toMatch(/https?:\/\//);
  });

  it("利用規約に必要な条項が揃っている", () => {
    const headings = legalDocuments.terms.sections.map(
      (section) => section.heading,
    );
    for (const expected of [
      "本アプリの内容",
      "利用者の責任",
      "禁止事項",
      "免責",
      "準拠法",
    ])
      expect(headings.some((heading) => heading.includes(expected))).toBe(true);
  });

  it("免責に故意・重過失の留保がある", () => {
    // 全部免責は消費者契約法 8 条により無効となり得るため、留保を外さない
    const disclaimer = legalDocuments.terms.sections.find((section) =>
      section.heading.includes("免責"),
    );
    const text = disclaimer?.paragraphs?.join("\n") ?? "";
    expect(text).toContain("責任を負いません");
    expect(text).toContain("故意または重大な過失による場合を除き");
  });

  it("利用規約が端末内保存と利用者責任を明記している", () => {
    const text = JSON.stringify(legalDocuments.terms);
    expect(text).toContain("端末");
    expect(text).toContain("バックアップ");
    expect(text).toContain("適法");
  });

  it("プライバシーポリシーが収集しない項目を列挙している", () => {
    const text = JSON.stringify(legalDocuments.privacy);
    for (const expected of ["アクセス解析", "Cookie", "広告", "外部"])
      expect(text).toContain(expected);
  });

  it("プライバシーポリシーが削除手段を案内している", () => {
    const text = JSON.stringify(legalDocuments.privacy);
    expect(text).toContain("この端末のデータをすべて削除");
  });

  it("居住地などの不要な個人情報を書かない", () => {
    // 管轄は「提供者の住所地」と表現し、地名は書かない方針
    expect(allText).not.toMatch(/札幌|北海道/);
  });

  it("両方の文書に問い合わせ先の節がある", () => {
    for (const document of documents)
      expect(
        document.sections.some((section) =>
          section.heading.includes("お問い合わせ"),
        ),
      ).toBe(true);
  });
});

describe("提供者情報", () => {
  it("公開に必要な項目がすべて埋まっている", () => {
    // 公開前ガード。プレースホルダを持ち込んだらここで落ちる
    expect(hasUnsetPublisherFields()).toBe(false);
    expect(unsetPublisherFields()).toEqual([]);
  });

  it("文書本文にプレースホルダが残っていない", () => {
    expect(allText).not.toContain(PUBLISHER_PLACEHOLDER);
  });

  it("連絡先がメールアドレスの体裁になっている", () => {
    // 打ち間違いの検知。規約の窓口が届かないアドレスになるのを防ぐ
    expect(publisher.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(isPlaceholder(publisher.email)).toBe(false);
  });

  it("提供者名と連絡先が両方の文書に出る", () => {
    for (const document of documents) {
      const contact = document.sections.find((section) =>
        section.heading.includes("お問い合わせ"),
      );
      expect(contact?.paragraphs?.join("\n")).toContain(publisher.name);
      expect(contact?.paragraphs?.join("\n")).toContain(publisher.email);
    }
  });
});
