// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import EditorLoadBoundary from "./EditorLoadBoundary";
import { localApi, resetStoreCache } from "../../storage/localApi";
import { writeStorageMode } from "../../storage/storageMode";
import { saveJsonFile } from "../../storage/fileIo";

vi.mock("../../storage/fileIo", async (original) => ({
  ...(await original<typeof import("../../storage/fileIo")>()),
  saveJsonFile: vi.fn(async () => true),
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  resetStoreCache();
  vi.restoreAllMocks();
});

it("エディター資材の失敗でも一時データを保持し、JSONに退避できる", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  writeStorageMode("session");
  await localApi.createChart("読み込み失敗時も保持");
  function BrokenChunk(): never {
    throw new Error("Failed to fetch dynamically imported module");
  }
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <EditorLoadBoundary>
          <BrokenChunk />
        </EditorLoadBoundary>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText(/エディターを読み込めませんでした/);
  fireEvent.click(
    screen.getByRole("button", { name: "全データをバックアップ" }),
  );
  await waitFor(() => expect(saveJsonFile).toHaveBeenCalledOnce());
  const raw = vi.mocked(saveJsonFile).mock.calls[0][1];
  expect(JSON.parse(raw).charts[0].title).toBe("読み込み失敗時も保持");
  expect((await localApi.charts())[0].title).toBe("読み込み失敗時も保持");
});
