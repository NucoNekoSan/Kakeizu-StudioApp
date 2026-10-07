// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BackupPanel from "./BackupPanel";
import BackupReminder from "./BackupReminder";
import { api } from "../../api";

vi.mock("../../api", () => ({
  api: {
    backupStatus: vi.fn(),
    createBackup: vi.fn(),
    markExported: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));
vi.mock("../../storage/fileIo", () => ({
  saveJsonFile: vi.fn(),
  readTextFile: vi.fn(),
}));

const renderWith = (ui: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("BackupPanel", () => {
  beforeEach(() => {
    vi.mocked(api.backupStatus).mockResolvedValue({
      chartCount: 3,
      lastExportedAt: null,
      daysSinceExport: null,
    });
    localStorage.setItem("kakeizu:storage-mode", "persistent");
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("保存方法と端末データの削除だけを表示する", async () => {
    renderWith(<BackupPanel />);
    expect(screen.getByRole("heading", { name: "保存方法" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "この端末のデータを削除" }),
    ).toBeTruthy();
    expect(screen.queryByText("JSONファイルに書き出す")).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

describe("BackupReminder", () => {
  const renderReminder = () =>
    renderWith(<BackupReminder onExport={vi.fn()} />);

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("一度も書き出していなければ警告する", async () => {
    vi.mocked(api.backupStatus).mockResolvedValue({
      chartCount: 2,
      lastExportedAt: null,
      daysSinceExport: null,
    });
    renderReminder();
    expect(
      await screen.findByText(/まだバックアップを書き出していません/),
    ).toBeTruthy();
  });

  it("7日以上経過していれば経過日数を出す", async () => {
    vi.mocked(api.backupStatus).mockResolvedValue({
      chartCount: 2,
      lastExportedAt: "2026-09-01T00:00:00.000Z",
      daysSinceExport: 13,
    });
    renderReminder();
    expect(await screen.findByText(/13日が経過/)).toBeTruthy();
  });

  it("直近に書き出していれば何も出さない", async () => {
    vi.mocked(api.backupStatus).mockResolvedValue({
      chartCount: 2,
      lastExportedAt: "2026-09-13T00:00:00.000Z",
      daysSinceExport: 1,
    });
    const { container } = renderReminder();
    await waitFor(() => expect(api.backupStatus).toHaveBeenCalled());
    expect(container.querySelector(".backup-reminder")).toBeNull();
  });

  it("相関図が無ければ何も出さない", async () => {
    vi.mocked(api.backupStatus).mockResolvedValue({
      chartCount: 0,
      lastExportedAt: null,
      daysSinceExport: null,
    });
    const { container } = renderReminder();
    await waitFor(() => expect(api.backupStatus).toHaveBeenCalled());
    expect(container.querySelector(".backup-reminder")).toBeNull();
  });
});
