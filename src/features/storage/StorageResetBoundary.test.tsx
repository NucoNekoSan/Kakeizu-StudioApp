// @vitest-environment jsdom
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import StorageResetBoundary from "./StorageResetBoundary";
import { readStorageMode, writeStorageMode } from "../../storage/storageMode";
import {
  publishStorageReset,
  subscribeStorageReset,
} from "../../storage/storageReset";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function PrivateView() {
  const [value] = useState(() =>
    readStorageMode() ? "削除前の個人情報" : "保存方法を選択",
  );
  return <p>{value}</p>;
}

it("他タブの削除通知で、古いフォーム・クエリとタブの保存モードを破棄する", () => {
  vi.stubGlobal("BroadcastChannel", undefined);
  writeStorageMode("session");
  const client = new QueryClient();
  client.setQueryData(["chart", "private"], { memo: "削除前の個人情報" });
  render(
    <QueryClientProvider client={client}>
      <StorageResetBoundary>
        <PrivateView />
      </StorageResetBoundary>
    </QueryClientProvider>,
  );
  expect(screen.getByText("削除前の個人情報")).toBeTruthy();
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "kakeizu:data-reset",
        newValue: "a".repeat(32),
      }),
    ),
  );
  expect(screen.queryByText("削除前の個人情報")).toBeNull();
  expect(screen.getByText("保存方法を選択")).toBeTruthy();
  expect(client.getQueryData(["chart", "private"])).toBeUndefined();
  expect(readStorageMode()).toBeNull();
});

it("同一タブへの通知と重複通知を扱い、解除後には反応しない", () => {
  vi.stubGlobal("BroadcastChannel", undefined);
  const reset = vi.fn();
  const stop = subscribeStorageReset(reset);
  publishStorageReset();
  expect(reset).toHaveBeenCalledTimes(1);
  const event = () =>
    new StorageEvent("storage", {
      key: "kakeizu:data-reset",
      newValue: "b".repeat(32),
    });
  window.dispatchEvent(event());
  window.dispatchEvent(event());
  expect(reset).toHaveBeenCalledTimes(2);
  stop();
  publishStorageReset();
  expect(reset).toHaveBeenCalledTimes(2);
});
