/**
 * 提供者の識別情報。規約・プライバシーポリシーの「お問い合わせ」欄に出る。
 *
 * 提供者名や連絡先を変えたいときはこのファイルを更新する。
 * 文書本文 (legalContent.ts) はここを参照しているだけなので修正は不要。
 *
 * プレースホルダのまま残っている項目があれば、文書ページに警告が出て
 * `legalContent.test.ts` も落ちる（公開前の埋め忘れを防ぐため）。
 */
export const PUBLISHER_PLACEHOLDER = "__未設定__";

export const publisher = {
  /** 提供者名（個人名または屋号）。規約・ポリシーの「提供者」欄に出る */
  name: "ひでき（ぬこねこの庭 運営）",
  /** 公開する問い合わせ窓口の URL */
  contactUrl: "https://nuconeko-garden.com/",
  /** 各文書の最終改定日 */
  revisedOn: "2026-09-24",
} as const;

export const isPlaceholder = (value: string) =>
  value.includes(PUBLISHER_PLACEHOLDER);

/** 公開前に埋める必要がある項目と、警告に出す表示名 */
const REQUIRED_FIELDS = [
  ["name", "提供者名"],
  ["contactUrl", "連絡先"],
] as const;

/** 未設定の項目名。UI の警告で「何が足りないか」を示すために使う。 */
export const unsetPublisherFields = (): string[] =>
  REQUIRED_FIELDS.filter(([key]) => isPlaceholder(publisher[key])).map(
    ([, label]) => label,
  );

/** 公開前に埋めるべき項目が残っているか。 */
export const hasUnsetPublisherFields = (): boolean =>
  unsetPublisherFields().length > 0;
