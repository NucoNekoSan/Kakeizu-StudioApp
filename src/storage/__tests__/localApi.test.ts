import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../kv", async () => {
  const actual =
    await vi.importActual<typeof import("../kv")>("../kv");
  return {
    ...actual,
    createIndexedDbStore: vi.fn(),
  };
});

import { createIndexedDbStore } from "../kv";
import { isStorageFallback, resetStoreCache, localApi } from "../localApi";
import * as storageMode from "../storageMode";

const mockCreateIdb = vi.mocked(createIndexedDbStore);

describe("IndexedDB フォールバック検知", () => {
  beforeEach(() => {
    resetStoreCache();
    vi.spyOn(storageMode, "readStorageMode").mockReturnValue("persistent");
  });

  it("IndexedDB 失敗時に isStorageFallback が true を返す", async () => {
    mockCreateIdb.mockRejectedValue(new Error("IDB blocked"));
    await localApi.charts();
    expect(isStorageFallback()).toBe(true);
  });

  it("IndexedDB 成功時に isStorageFallback が false を返す", async () => {
    const { createMemoryStore } = await import("../kv");
    mockCreateIdb.mockResolvedValue(createMemoryStore());
    await localApi.charts();
    expect(isStorageFallback()).toBe(false);
  });

  it("resetStoreCache でフラグがリセットされる", async () => {
    mockCreateIdb.mockRejectedValue(new Error("IDB blocked"));
    await localApi.charts();
    expect(isStorageFallback()).toBe(true);
    resetStoreCache();
    expect(isStorageFallback()).toBe(false);
  });
});
