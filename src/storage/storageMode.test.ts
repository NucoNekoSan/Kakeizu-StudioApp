// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appStorageKeys,
  clearStorageMode,
  readStorageMode,
  STORAGE_MODE_KEY,
  writeStorageMode,
} from "./storageMode";

describe("保存モード", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("未選択なら null を返す", () => {
    expect(readStorageMode()).toBeNull();
  });

  it("端末に保存する選択は localStorage に残す", () => {
    writeStorageMode("persistent");
    expect(localStorage.getItem(STORAGE_MODE_KEY)).toBe("persistent");
    expect(sessionStorage.getItem(STORAGE_MODE_KEY)).toBeNull();
    expect(readStorageMode()).toBe("persistent");
  });

  it("一時利用の選択は localStorage に残さない", () => {
    // 端末に残す情報を増やさないため、一時モードの選択は localStorage へ書かない
    writeStorageMode("session");
    expect(localStorage.getItem(STORAGE_MODE_KEY)).toBeNull();
    expect(readStorageMode()).toBe("session");
  });

  it("端末に保存する選択が一時選択より優先される", () => {
    writeStorageMode("session");
    writeStorageMode("persistent");
    expect(readStorageMode()).toBe("persistent");
  });

  it("選択を解除できる", () => {
    writeStorageMode("persistent");
    clearStorageMode();
    expect(readStorageMode()).toBeNull();
  });

  it("アプリのキーだけを列挙する", () => {
    localStorage.setItem("kakeizu:cohabitation-draft:v1:abc", "{}");
    localStorage.setItem("kakeizu:cohabitations:abc", "[]");
    localStorage.setItem("other-app", "x");
    const keys = appStorageKeys();
    expect(keys).toHaveLength(2);
    expect(keys).not.toContain("other-app");
  });

  it("localStorage が使えなくても例外を投げない", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    expect(() => readStorageMode()).not.toThrow();
    expect(() => writeStorageMode("persistent")).not.toThrow();
    expect(appStorageKeys()).toEqual([]);
    if (original) Object.defineProperty(window, "localStorage", original);
  });
});
