// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { saveJsonFile } from "../../storage/fileIo";
import ChartsPage from "./ChartsPage";

vi.mock("../../api", () => ({
  api: {
    charts: vi.fn(),
    createChart: vi.fn(),
    deleteChart: vi.fn(),
    createChartBackup: vi.fn(),
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

const renderPage = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <ChartsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("相関図一覧の個別JSON書き出し", () => {
  beforeEach(() => {
    vi.mocked(api.charts).mockResolvedValue([
      {
        id: "chart-a",
        title: "家族A",
        nodeCount: 3,
        updatedAt: "2026-09-24T00:00:00.000Z",
      },
      {
        id: "chart-b",
        title: "家族B",
        nodeCount: 2,
        updatedAt: "2026-09-24T00:00:00.000Z",
      },
    ]);
    vi.mocked(api.backupStatus).mockResolvedValue({
      chartCount: 2,
      lastExportedAt: "2026-09-24T00:00:00.000Z",
      daysSinceExport: 0,
    });
    vi.mocked(api.createChartBackup).mockResolvedValue({
      fileName: "kakeizu-家族A-20260924-1200.json",
      json: '{"charts":[]}',
      backup: {} as never,
    });
    vi.mocked(saveJsonFile).mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("選択した相関図だけを書き出す", async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "家族AをJSONファイルに書き出す",
      }),
    );

    await waitFor(() =>
      expect(api.createChartBackup).toHaveBeenCalledWith("chart-a"),
    );
    expect(saveJsonFile).toHaveBeenCalledWith(
      "kakeizu-家族A-20260924-1200.json",
      '{"charts":[]}',
    );
    expect(await screen.findByText(/書き出しました/)).toBeTruthy();
  });

  it("保存をキャンセルした場合は成功通知を出さない", async () => {
    vi.mocked(saveJsonFile).mockResolvedValue(false);
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "家族AをJSONファイルに書き出す",
      }),
    );

    await waitFor(() => expect(saveJsonFile).toHaveBeenCalled());
    expect(screen.queryByText(/書き出しました/)).toBeNull();
  });

  it("失敗時にエラーを表示し、操作を再開できる", async () => {
    vi.mocked(api.createChartBackup).mockRejectedValue(new Error("保存失敗"));
    renderPage();
    const button = await screen.findByRole("button", {
      name: "家族AをJSONファイルに書き出す",
    });
    fireEvent.click(button);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "JSONを書き出せませんでした",
    );
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false),
    );
  });
});
