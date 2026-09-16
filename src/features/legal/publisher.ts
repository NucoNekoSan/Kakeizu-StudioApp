/**
 * 提供者の識別情報。
 *
 * このリポジトリは public のため、連絡先を直接書き込むと公開される。
 * 公開前にこのファイルだけを書き換える運用にしている。
 *
 * 未設定の項目が残っているかは `legalContent.test.ts` が検知し、
 * 文書ページを開いたときにも画面上に警告が出る。
 */
export const PUBLISHER_PLACEHOLDER = "__未設定__";

export const publisher = {
  /** 提供者名（個人名または屋号）。規約・ポリシーの「提供者」欄に出る */
  name: "NucoNekoSan",
  /** 問い合わせ先メールアドレス。未設定のままでは規約が機能しない */
  email: PUBLISHER_PLACEHOLDER,
  /** 各文書の最終改定日 */
  revisedOn: "2026-09-16",
} as const;

export const isPlaceholder = (value: string) =>
  value.includes(PUBLISHER_PLACEHOLDER);

/** 公開前に埋める必要がある項目と、警告に出す表示名 */
const REQUIRED_FIELDS = [
  ["name", "提供者名"],
  ["email", "連絡先"],
] as const;

/** 未設定の項目名。UI の警告で「何が足りないか」を示すために使う。 */
export const unsetPublisherFields = (): string[] =>
  REQUIRED_FIELDS.filter(([key]) => isPlaceholder(publisher[key])).map(
    ([, label]) => label,
  );

/** 公開前に埋めるべき項目が残っているか。 */
export const hasUnsetPublisherFields = (): boolean =>
  unsetPublisherFields().length > 0;
