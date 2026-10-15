// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/errors";
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

  it("保留されたままなら成功扱いにせず、データも半端に消さない", async () => {
    vi.useFakeTimers();
    stubDelete((request) => request.onblocked?.());
    const done = clearBrowserData();
    const result = expect(done).rejects.toMatchObject({
      code: "DATA_DELETE_BLOCKED",
    });
    await vi.advanceTimersByTimeAsync(DELETE_BLOCKED_TIMEOUT_MS);
    await result;
    await done.catch((error) => expect(error).toBeInstanceOf(ApiError));
    expect(localStorage.getItem("kakeizu:cohabitations:abc")).not.toBeNull();
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
  it("versionchange で接続を閉じ、次の操作で開き直す", async () => {
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

    expect(await store.get("k")).toBe("値");
    expect(open).toHaveBeenCalledTimes(2);
  });
});
