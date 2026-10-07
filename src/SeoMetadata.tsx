import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ORIGIN = "https://kakeizu-studioapp.nuconeko-garden.com";

const PUBLIC_PAGES: Record<string, { title: string; description: string }> = {
  "/charts": {
    title: "Kakeizu Studio | 家族相関図作成アプリ",
    description:
      "Kakeizu Studioは、続柄を選んで家族相関図を作成できる無料のWebアプリです。データは端末内に保存し、PNG・JPEG・PDFで書き出せます。",
  },
  "/help": {
    title: "使い方 | Kakeizu Studio",
    description:
      "Kakeizu Studioで家族相関図を作成、編集、出力する方法と、端末内保存やバックアップの使い方を紹介します。",
  },
  "/terms": {
    title: "利用規約 | Kakeizu Studio",
    description: "Kakeizu Studioの利用規約をご案内します。",
  },
  "/privacy": {
    title: "プライバシーポリシー | Kakeizu Studio",
    description:
      "Kakeizu Studioのデータの保存方法とプライバシーポリシーをご案内します。",
  },
};

function setMeta(name: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`,
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.append(meta);
  }
  meta.content = content;
}

export default function SeoMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = PUBLIC_PAGES[pathname];
    document.title = page?.title ?? "Kakeizu Studio";
    setMeta(
      "description",
      page?.description ?? "続柄と性別から家族相関図を作成するツール",
    );

    // 利用者固有の編集画面などは検索結果に表示しない。
    setMeta("robots", page ? "index, follow" : "noindex, follow");

    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (page) {
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.append(canonical);
      }
      canonical.href = `${ORIGIN}${pathname}`;
    } else {
      canonical?.remove();
    }
  }, [pathname]);

  return null;
}
