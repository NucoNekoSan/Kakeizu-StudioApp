// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BackupPanel from "./BackupPanel";
import BackupReminder from "./BackupReminder";
import { api } from "../../api";
import { saveJsonFile } from "../../storage/fileIo";

vi.mock("../../api", () => ({
  api: {
    backupStatus: vi.fn(),
    createBackup: vi.fn(),
    markExported: vi.fn(),
    importBackup: vi.fn(),
    isEncryptedFile: vi.fn(async () => false),
  },
  ApiError: class ApiError extends Error {},
}));
vi.mock("../../storage/fileIo", () => ({
  saveJsonFile: vi.fn(),
  readTextFile: vi.fn(async () => "{}"),
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
    vi.mocked(api.createBackup).mockResolvedValue({
      fileName: "kakeizu-backup-20260914-0705.json",
      json: "{}",
      backup: {} as never,
      encrypted: false,
    });
    vi.mocked(saveJsonFile).mockResolvedValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("端末内保存であることと未実施であることを伝える", async () => {
    renderWith(<BackupPanel />);
    expect(await screen.findByText("未実施")).toBeTruthy();
    expect(screen.getByText(/この端末のブラウザ内にのみ保存/)).toBeTruthy();
  });

  it("書き出しに成功したら保存済みとして記録する", async () => {
    renderWith(<BackupPanel />);
    fireEvent.click(await screen.findByText(/JSONファイルに書き出す/));
    await waitFor(() => expect(api.markExported).toHaveBeenCalledOnce());
    expect(saveJsonFile).toHaveBeenCalledWith(
      "kakeizu-backup-20260914-0705.json",
      "{}",
    );
  });

  it("保存ダイアログを取り消したときは書き出し済みにしない", async () => {
    vi.mocked(saveJsonFile).mockResolvedValue(false);
    renderWith(<BackupPanel />);
    fireEvent.click(await screen.findByText(/JSONファイルに書き出す/));
    await waitFor(() => expect(saveJsonFile).toHaveBeenCalled());
    expect(api.markExported).not.toHaveBeenCalled();
  });

  it("置き換えを選ぶと消える旨を警告する", async () => {
    renderWith(<BackupPanel />);
    await screen.findByText("未実施");
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["{}"], "backup.json", {
      type: "application/json",
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("バックアップを読み込む")).toBeTruthy();
    expect(api.importBackup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/置き換える/));
    expect(screen.getByText(/すべて削除され/)).toBeTruthy();

    fireEvent.click(screen.getByText("読み込む"));
    await waitFor(() =>
      expect(api.importBackup).toHaveBeenCalledWith("{}", "replace", undefined),
    );
  });
});

describe("BackupReminder", () => {
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
    renderWith(<BackupReminder />);
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
    renderWith(<BackupReminder />);
    expect(await screen.findByText(/13日が経過/)).toBeTruthy();
  });

  it("直近に書き出していれば何も出さない", async () => {
    vi.mocked(api.backupStatus).mockResolvedValue({
      chartCount: 2,
      lastExportedAt: "2026-09-13T00:00:00.000Z",
      daysSinceExport: 1,
    });
    const { container } = renderWith(<BackupReminder />);
    await waitFor(() => expect(api.backupStatus).toHaveBeenCalled());
    expect(container.querySelector(".backup-reminder")).toBeNull();
  });

  it("相関図が無ければ何も出さない", async () => {
    vi.mocked(api.backupStatus).mockResolvedValue({
      chartCount: 0,
      lastExportedAt: null,
      daysSinceExport: null,
    });
    const { container } = renderWith(<BackupReminder />);
    await waitFor(() => expect(api.backupStatus).toHaveBeenCalled());
    expect(container.querySelector(".backup-reminder")).toBeNull();
  });
});
