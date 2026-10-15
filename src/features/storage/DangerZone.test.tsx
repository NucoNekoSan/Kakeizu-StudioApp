// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DangerZone from "./DangerZone";
import { clearBrowserData } from "../../storage/localApi";

vi.mock("../../storage/localApi", async (original) => ({
  ...(await original<typeof import("../../storage/localApi")>()),
  clearBrowserData: vi.fn(),
}));
vi.mock("../backup/useBackup", () => ({
  useBackupStatus: () => ({ data: { chartCount: 1 } }),
  useBackup: () => ({ exportBackup: vi.fn(), busy: null }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("削除保留を失敗と表示せず、重複操作を止め、遅れて届く成功で完了する", async () => {
  let finish!: () => void;
  vi.mocked(clearBrowserData).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<DangerZone />);
  fireEvent.click(
    screen.getByRole("button", { name: "この端末のデータをすべて削除" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "すべて削除する" }));
  act(() => vi.mocked(clearBrowserData).mock.calls[0][0]?.onBlocked?.());
  expect(screen.getByText(/削除を保留しています/)).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "キャンセル" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  const waiting = screen.getByRole("button", {
    name: "削除の完了を待っています…",
  });
  expect((waiting as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(waiting);
  expect(clearBrowserData).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(screen.getByText("削除しました。")).toBeTruthy();
  expect(screen.queryByText(/削除できませんでした/)).toBeNull();
});
