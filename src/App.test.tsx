// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { Shell } from "./components/ui";
import { api } from "./api";

vi.mock("./api", () => ({
  api: {
    charts: vi.fn(async () => []),
    backupStatus: vi.fn(async () => ({
      chartCount: 0,
      lastExportedAt: null,
      daysSinceExport: null,
    })),
  },
  ApiError: class ApiError extends Error {},
}));

const renderApp = (path: string) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("認証の撤去", () => {
  beforeEach(() => {
    localStorage.setItem("kakeizu:storage-mode", "persistent");
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("廃止した /login は相関図一覧へ送られる", async () => {
    renderApp("/login");
    // ログインの入力欄ではなく一覧が出る
    await waitFor(() => expect(api.charts).toHaveBeenCalled());
    expect(screen.queryByLabelText(/ログインID/)).toBeNull();
    expect(screen.queryByText("ログイン")).toBeNull();
  });

  it("未知のパスも相関図一覧へ送られる", async () => {
    renderApp("/does-not-exist");
    await waitFor(() => expect(api.charts).toHaveBeenCalled());
  });

  it("認証の往復なしで一覧を描画する", async () => {
    renderApp("/charts");
    // かつては session() の解決を待ってから描画していた
    await waitFor(() => expect(api.charts).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "相関図" })).toBeTruthy();
  });

  it("ナビゲーションにログアウトが無い", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Shell>
            <p>本文</p>
          </Shell>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.queryByText("ログアウト")).toBeNull();
    expect(screen.getByRole("link", { name: /相関図/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /設定/ })).toBeTruthy();
  });
});

describe("認証が復活しないための回帰ガード", () => {
  it("api が認証系の関数を公開していない", async () => {
    // モックを外した実体を確認する
    const actual =
      await vi.importActual<typeof import("./storage/localApi")>(
        "./storage/localApi",
      );
    for (const removed of ["session", "login", "logout"])
      expect(Object.keys(actual.localApi)).not.toContain(removed);
  });
});
