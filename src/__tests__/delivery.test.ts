import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

/**
 * 配信設定の回帰テスト。
 * ブラウザを立てないと気づけない種類の事故 (CSP 違反・外部送信) を、
 * 静的な検査で早い段階に落とす。
 */
describe("外部送信ゼロ", () => {
  it("スタイルシートが外部ホストを参照しない", () => {
    // 以前 Google Fonts を @import しており、閲覧のたびに利用者の IP が
    // 第三者へ送られていた。ADR-001 の前提を壊すため恒久的に禁止する。
    const styles = read("src/styles.css");
    expect(styles).not.toMatch(/@import\s+url\(\s*["']?https?:/i);
    expect(styles).not.toMatch(/https?:\/\//);
  });

  it("HTML が外部ホストを参照しない", () => {
    expect(read("index.html")).not.toMatch(/(?:src|href)=["']https?:\/\//i);
  });

  it("アプリコードに外部への fetch が無い", () => {
    const sources = import.meta.glob("../**/*.{ts,tsx}", {
      eager: true,
      query: "?raw",
      import: "default",
    }) as Record<string, string>;
    const offenders = Object.entries(sources).filter(
      ([path, code]) =>
        !path.includes(".test.") && /fetch\(\s*["'`]https?:/.test(code),
    );
    expect(offenders.map(([path]) => path)).toEqual([]);
  });
});

describe("_headers", () => {
  const headers = read("public/_headers");

  it("インラインスクリプトを許可しない", () => {
    expect(headers).toMatch(/script-src 'self'/);
    expect(headers).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(headers).not.toMatch(/script-src[^;]*unsafe-eval/);
  });

  it("既定の取得元を自オリジンに閉じる", () => {
    expect(headers).toMatch(/default-src 'self'/);
    expect(headers).toMatch(/connect-src 'self'/);
    expect(headers).toMatch(/frame-ancestors 'none'/);
    expect(headers).toMatch(/object-src 'none'/);
  });

  it("Service Worker と manifest を長期キャッシュしない", () => {
    // ファイル名が変わらないため、長期キャッシュすると更新が届かなくなる。
    for (const path of ["/sw.js", "/index.html", "/manifest.webmanifest"])
      expect(headers).toMatch(
        new RegExp(
          `${path.replace(/[/.]/g, "\\$&")}\\s+Cache-Control: no-cache`,
        ),
      );
  });

  it("ハッシュ付きアセットは長期キャッシュする", () => {
    expect(headers).toMatch(
      /\/assets\/\*\s+Cache-Control: public, max-age=31536000, immutable/,
    );
  });
});

describe("PWA 設定", () => {
  const config = read("vite.config.ts");

  it("登録スクリプトを自動注入しない", () => {
    // 自動注入はインラインスクリプトになり得るため CSP と衝突する。
    expect(config).toMatch(/injectRegister:\s*null/);
  });

  it("更新を利用者の操作で適用する", () => {
    // 編集中に勝手にリロードされると入力が失われる。
    expect(config).toMatch(/registerType:\s*"prompt"/);
  });

  it("インストールに必要なアイコンを宣言する", () => {
    for (const size of ["192x192", "512x512"]) expect(config).toContain(size);
    expect(config).toMatch(/purpose:\s*"maskable"/);
  });
});
