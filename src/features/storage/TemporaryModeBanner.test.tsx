// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIndexedDbStore, createMemoryStore } from "../../storage/kv";
import {
  isStorageFallback,
  localApi,
  resetStoreCache,
} from "../../storage/localApi";
import { writeStorageMode } from "../../storage/storageMode";
import TemporaryModeBanner from "./TemporaryModeBanner";

vi.mock("../../storage/kv", async (original) => ({
  ...(await original<typeof import("../../storage/kv")>()),
  createIndexedDbStore: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetStoreCache();
  vi.resetAllMocks();
  writeStorageMode("persistent");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetStoreCache();
});

function renderBanner() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TemporaryModeBanner />
    </QueryClientProvider>,
  );
}

const unload = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe("保存できない場合の警告", () => {
  it.each(["initialization", "probe"])(
    "%s 失敗後のクエリ完了で警告を表示し、作成後は離脱を引き止める",
    async (failure) => {
      if (failure === "initialization")
        vi.mocked(createIndexedDbStore).mockRejectedValue(new Error("blocked"));
      else {
        const store = createMemoryStore();
        vi.spyOn(store, "keys").mockRejectedValue(new Error("blocked"));
        vi.mocked(createIndexedDbStore).mockResolvedValue(store);
      }
      const view = renderBanner();
      const warning = await screen.findByRole("alert");
      expect(warning.textContent).toContain("再読み込みすると失われます");
      expect(isStorageFallback()).toBe(true);
      expect(unload()).toBe(false);
      await localApi.createChart("退避中のデータ");
      // 別画面でも同じストアを使い、バックアップ件数の更新後に保護する。
      view.unmount();
      const next = renderBanner();
      await waitFor(() => expect(unload()).toBe(true));
      next.unmount();
      expect(unload()).toBe(false);
      resetStoreCache();
      expect(isStorageFallback()).toBe(false);
    },
  );

  it("永続保存が成功した場合は警告も離脱防止も出さない", async () => {
    vi.mocked(createIndexedDbStore).mockResolvedValue(createMemoryStore());
    await localApi.createChart("保存済み");
    renderBanner();
    await localApi.backupStatus();
    expect(isStorageFallback()).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(unload()).toBe(false);
  });

  it("一時利用では IndexedDB に触れず、既存の離脱防止を維持する", async () => {
    writeStorageMode("session");
    await localApi.createChart("一時データ");
    renderBanner();
    expect(screen.getByRole("status").textContent).toContain("一時利用モード");
    await waitFor(() => expect(unload()).toBe(true));
    expect(createIndexedDbStore).not.toHaveBeenCalled();
    expect(isStorageFallback()).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
