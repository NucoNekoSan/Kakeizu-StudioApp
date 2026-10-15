// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ChartsPage from "../charts/ChartsPage";
import TemporaryModeBanner from "./TemporaryModeBanner";
import { backupStatusKey } from "../backup/useBackup";
import { writeStorageMode } from "../../storage/storageMode";
import { resetStoreCache } from "../../storage/localApi";
import { createIndexedDbStore } from "../../storage/kv";

vi.mock("../../storage/kv", async (original) => ({
  ...(await original<typeof import("../../storage/kv")>()),
  createIndexedDbStore: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetStoreCache();
  vi.mocked(createIndexedDbStore).mockRejectedValue(new Error("IDB blocked"));
});
afterEach(() => {
  cleanup();
  resetStoreCache();
  vi.restoreAllMocks();
});

const guarded = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

it.each(["session", "persistent"] as const)(
  "%s: 同じ20秒キャッシュのまま作成直後から保護し、最後の図の削除後は解除する",
  async (mode) => {
    writeStorageMode(mode);
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 20_000, gcTime: 0 },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/charts"]}>
          <Routes>
            <Route path="/charts" element={<ChartsPage />} />
            <Route
              path="/charts/:id"
              element={
                <>
                  <TemporaryModeBanner />
                  <Link to="/charts">一覧へ</Link>
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(client.getQueryData(backupStatusKey)).toMatchObject({
        chartCount: 0,
      }),
    );
    expect(guarded()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "新しい相関図" }));
    fireEvent.change(screen.getByRole("textbox", { name: "タイトル" }), {
      target: { value: "作成直後" },
    });
    fireEvent.click(screen.getByRole("button", { name: "作成する" }));
    await screen.findByRole("link", { name: "一覧へ" });
    await waitFor(() => expect(guarded()).toBe(true));
    expect(client.getQueryData(backupStatusKey)).toMatchObject({
      chartCount: 1,
    });
    fireEvent.click(screen.getByRole("link", { name: "一覧へ" }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(
      await screen.findByRole("button", { name: "作成直後を削除" }),
    );
    await waitFor(() =>
      expect(client.getQueryData(backupStatusKey)).toMatchObject({
        chartCount: 0,
      }),
    );
    await waitFor(() => expect(guarded()).toBe(false));
    client.clear();
  },
);
