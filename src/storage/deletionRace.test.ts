// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { createMemoryStore } from "./kv";
import { decryptBackup } from "./crypto";
import {
  clearBrowserData,
  createLocalApi,
  localApi,
  resetStoreCache,
} from "./localApi";
import { writeStorageMode } from "./storageMode";

vi.mock("./crypto", async (original) => {
  const actual = await original<typeof import("./crypto")>();
  return { ...actual, decryptBackup: vi.fn(actual.decryptBackup) };
});

afterEach(() => {
  resetStoreCache();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["merge", "replace"] as const)(
  "%s: 削除前の復号中・キュー待機中の要求は、削除後に保存できない",
  async (mode) => {
    const api = createLocalApi(createMemoryStore());
    await api.createChart("削除前の架空データ");
    const { json } = await api.createBackup();
    let begin!: () => void;
    const started = new Promise<void>((resolve) => (begin = resolve));
    let release!: (raw: string) => void;
    vi.mocked(decryptBackup).mockImplementationOnce(() => {
      begin();
      return new Promise<string>((resolve) => (release = resolve));
    });
    const importing = api.importBackup('{"encrypted":true}', mode, "test");
    const queued = api.createChart("古いキューの追加");
    const rejected = Promise.all([
      expect(importing).rejects.toMatchObject({ code: "STORAGE_RESET" }),
      expect(queued).rejects.toMatchObject({ code: "STORAGE_RESET" }),
    ]);
    await started;
    vi.stubGlobal("indexedDB", {
      deleteDatabase: () => {
        const request: { onsuccess?: () => void } = {};
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    });
    await clearBrowserData();
    release(json);
    await rejected;
    const next = createLocalApi(createMemoryStore());
    expect(await next.charts()).toEqual([]);
    await expect(
      next.createChart("削除後の明示的な新規利用"),
    ).resolves.toMatchObject({
      title: "削除後の明示的な新規利用",
    });
  },
);

it("削除保留中の新規API呼び出しを拒否し、完了後の新しい選択を許可する", async () => {
  let complete!: () => void;
  vi.stubGlobal("indexedDB", {
    deleteDatabase: () => {
      const request: { onsuccess?: () => void } = {};
      complete = () => request.onsuccess?.();
      return request;
    },
  });
  writeStorageMode("session");
  const deleting = clearBrowserData();
  await expect(localApi.createChart("保留中")).rejects.toMatchObject({
    code: "STORAGE_RESET",
  });
  complete();
  await deleting;
  writeStorageMode("session");
  await expect(localApi.createChart("再開後")).resolves.toMatchObject({
    title: "再開後",
  });
});
