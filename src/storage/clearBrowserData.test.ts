// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIndexedDbStore } from "./kv";
import { clearBrowserData, DELETE_BLOCKED_TIMEOUT_MS } from "./localApi";

type FakeRequest = {
  onsuccess?: () => void;
  onerror?: () => void;
  onblocked?: () => void;
};

const stubDelete = (behave: (request: FakeRequest) => void) => {
  const deleteDatabase = vi.fn(() => {
    const request: FakeRequest = {};
    queueMicrotask(() => behave(request));
    return request;
  });
  vi.stubGlobal("indexedDB", { deleteDatabase });
  return deleteDatabase;
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("kakeizu:cohabitations:abc", "[]");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("全データ削除", () => {
  it("削除が完了したら localStorage の旧キーも消す", async () => {
    stubDelete((request) => request.onsuccess?.());
    await clearBrowserData();
    expect(localStorage.getItem("kakeizu:cohabitations:abc")).toBeNull();
  });

  it("別タブで保留されても、閉じられれば成功する", async () => {
    vi.useFakeTimers();
    stubDelete((request) => {
      request.onblocked?.();
      setTimeout(() => request.onsuccess?.(), 1000);
    });
    const done = clearBrowserData();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(done).resolves.toBeUndefined();
    expect(localStorage.getItem("kakeizu:cohabitations:abc")).toBeNull();
  });

  it("保留を通知し、重複要求を抑え、後から成功した時に初めて削除を完了する", async () => {
    vi.useFakeTimers();
    let held: FakeRequest;
    const remove = stubDelete((request) => {
      held = request;
      request.onblocked?.();
    });
    const onBlocked = vi.fn(),
      settled = vi.fn();
    const done = clearBrowserData({ onBlocked });
    void done.then(settled);
    expect(clearBrowserData()).toBe(done);
    await vi.advanceTimersByTimeAsync(DELETE_BLOCKED_TIMEOUT_MS);
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("kakeizu:cohabitations:abc")).not.toBeNull();
    held!.onsuccess?.();
    await done;
    expect(settled).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("kakeizu:cohabitations:abc")).toBeNull();
  });

  it("削除に失敗したら失敗として報告する", async () => {
    stubDelete((request) => request.onerror?.());
    await expect(clearBrowserData()).rejects.toMatchObject({
      code: "DATA_DELETE_FAILED",
    });
    expect(localStorage.getItem("kakeizu:cohabitations:abc")).not.toBeNull();
  });
});

describe("IndexedDB 接続", () => {
  it("versionchange で古い参照を失効させ、新しいストアだけが開き直せる", async () => {
    vi.stubGlobal("navigator", {
      locks: {
        request: (_name: string, _options: unknown, run: () => unknown) =>
          run(),
      },
    });
    const connections: {
      close: ReturnType<typeof vi.fn>;
      onversionchange?: () => void;
    }[] = [];
    const open = vi.fn(() => {
      const request: {
        result?: unknown;
        onsuccess?: () => void;
        oncomplete?: () => void;
        onupgradeneeded?: () => void;
      } = {};
      const objectStore = {
        get: () => {
          const get: { result: unknown; onsuccess?: () => void } = {
            result: "値",
          };
          queueMicrotask(() => get.onsuccess?.());
          return get;
        },
      };
      const db = {
        close: vi.fn(),
        onversionchange: undefined as (() => void) | undefined,
        transaction: () => ({ objectStore: () => objectStore }),
      };
      connections.push(db);
      request.result = db;
      queueMicrotask(() => request.onsuccess?.());
      return request;
    });
    vi.stubGlobal("indexedDB", { open });

    const store = await createIndexedDbStore();
    expect(await store.get("k")).toBe("値");
    expect(open).toHaveBeenCalledTimes(1);

    // 別の接続が deleteDatabase を要求したときの通知
    connections[0].onversionchange?.();
    expect(connections[0].close).toHaveBeenCalled();

    await expect(store.get("k")).rejects.toMatchObject({
      code: "STORAGE_RESET",
    });
    expect(open).toHaveBeenCalledTimes(1);
    const next = await createIndexedDbStore();
    expect(await next.get("k")).toBe("値");
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("タブ間の排他制御が使えない場合は永続ストアを開かない", async () => {
    const open = vi.fn();
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("indexedDB", { open });
    await expect(createIndexedDbStore()).rejects.toMatchObject({
      code: "STORAGE_LOCK_UNAVAILABLE",
    });
    expect(open).not.toHaveBeenCalled();
  });
});
