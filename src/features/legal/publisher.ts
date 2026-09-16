/**
 * 提供者の識別情報。
 *
 * このリポジトリは public のため、実際の氏名・メールアドレス・公開 URL を
 * 直接書き込むと個人の連絡先が公開される。公開前にこのファイルだけを
 * 書き換える運用にしている。
 *
 * PUBLISHER_PLACEHOLDER を含む値が残っているかは
 * `legalContent.test.ts` が検知する。
 */
export const PUBLISHER_PLACEHOLDER = "__未設定__";

export const publisher = {
  /** 提供者名（個人名または屋号） */
  name: PUBLISHER_PLACEHOLDER,
  /** 問い合わせ先メールアドレス */
  email: PUBLISHER_PLACEHOLDER,
  /** 公開URL（例: kakeizu.example.com） */
  siteUrl: PUBLISHER_PLACEHOLDER,
  /** 各文書の最終改定日 */
  revisedOn: "2026-09-16",
} as const;

export const isPlaceholder = (value: string) =>
  value.includes(PUBLISHER_PLACEHOLDER);

/** 公開前に埋めるべき項目が残っているか。UI の警告表示に使う。 */
export const hasUnsetPublisherFields = (): boolean =>
  [publisher.name, publisher.email, publisher.siteUrl].some(isPlaceholder);
