import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "@xyflow/react/dist/style.css";
import "./styles.css";
const client = new QueryClient({
  defaultOptions: {
    // ローカル保存なのでネットワーク再試行は無意味。networkMode を明示しないと
    // オフライン時にクエリが paused のまま止まる (PWA でオフライン利用するため必須)。
    queries: { retry: false, networkMode: "always", staleTime: 20_000 },
    mutations: { retry: 0, networkMode: "always" },
  },
});
async function clearLegacyWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  if (!registrations.length && !navigator.serviceWorker.controller) return;
  await Promise.all(
    registrations.map((registration) => registration.unregister()),
  );
  if ("caches" in window)
    await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
  const reloadKey = "kakeizu-worker-cleared-v1";
  if (
    navigator.serviceWorker.controller &&
    sessionStorage.getItem(reloadKey) !== "1"
  ) {
    sessionStorage.setItem(reloadKey, "1");
    location.reload();
    await new Promise(() => {});
  }
}
clearLegacyWorker()
  .catch(() => {})
  .finally(() =>
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </StrictMode>,
    ),
  );
