import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * 本番 (Cloudflare Pages) では public/_headers が同じ CSP を配信する。
 * 開発サーバーにも同じヘッダを入れて、本番との乖離に気づけるようにしている。
 */
const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const base = env.VITE_BASE_PATH || "/";
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        // 登録スクリプトは main.tsx から明示的に呼ぶ。
        // 自動注入はインラインスクリプトになり得るため、CSP の script-src 'self' と衝突する。
        injectRegister: null,
        registerType: "prompt",
        includeAssets: ["icons/apple-touch-icon.png"],
        manifest: {
          name: "Kakeizu Studio",
          short_name: "Kakeizu",
          description:
            "続柄と性別から家族相関図を作成するツール。データは端末内にのみ保存されます。",
          lang: "ja",
          dir: "ltr",
          start_url: base,
          scope: base,
          display: "standalone",
          orientation: "any",
          background_color: "#f4f2eb",
          theme_color: "#16382f",
          categories: ["productivity", "utilities"],
          icons: [
            {
              src: "icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icons/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // 完全オフラインで動かすため全アセットをプリキャッシュする。
          // 外部通信が無いので runtime caching は設定しない。
          globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
          navigateFallback: `${base.replace(/\/$/, "")}/index.html`,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
        },
        devOptions: { enabled: false },
      }),
    ],
    server: { port: 5173, headers: SECURITY_HEADERS },
    preview: { port: 4173, headers: SECURITY_HEADERS },
  };
});
