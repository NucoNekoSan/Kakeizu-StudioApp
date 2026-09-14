import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

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
  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [react()],
    server: { port: 5173, headers: SECURITY_HEADERS },
    preview: { headers: SECURITY_HEADERS },
  };
});
