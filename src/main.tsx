import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { setupServiceWorker } from "./pwa";
import { showUpdatePrompt } from "./updatePrompt";
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

setupServiceWorker(showUpdatePrompt);
