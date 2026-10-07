// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
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

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

const renderPage = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/charts"]}>
        <ChartsPage />
        <LocationProbe />
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

  const startBackupSelection = async () => {
    const backupButton = await screen.findByRole("button", {
      name: "相関図を選択してバックアップ",
    });
    await waitFor(() =>
      expect((backupButton as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(backupButton);
  };

  it("一覧のカードで選択した相関図だけを書き出す", async () => {
    renderPage();
    await startBackupSelection();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByText("バックアップする相関図を選択してください"),
    ).toBeTruthy();
    const exportButton = screen.getByRole("button", {
      name: "JSONファイルに書き出す",
    }) as HTMLButtonElement;
    expect(exportButton.disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /家族A/ }));
    expect(exportButton.disabled).toBe(false);
    expect(screen.getByText("「家族A」を選択中です。")).toBeTruthy();
    fireEvent.click(exportButton);

    await waitFor(() =>
      expect(api.createChartBackup).toHaveBeenCalledWith("chart-a"),
    );
    expect(saveJsonFile).toHaveBeenCalledWith(
      "kakeizu-家族A-20260924-1200.json",
      '{"charts":[]}',
    );
    expect(await screen.findByText(/書き出しました/)).toBeTruthy();
  });

  it("警告バーから画面遷移せずにバックアップ選択を開始する", async () => {
    vi.mocked(api.backupStatus).mockResolvedValue({
      chartCount: 2,
      lastExportedAt: null,
      daysSinceExport: null,
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "バックアップを書き出す",
      }),
    );

    expect(screen.getByTestId("location").textContent).toBe("/charts");
    expect(
      screen.getByText("バックアップする相関図を選択してください"),
    ).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("保存をキャンセルした場合は成功通知を出さない", async () => {
    vi.mocked(saveJsonFile).mockResolvedValue(false);
    renderPage();
    await startBackupSelection();
    const selectedChart = screen.getByRole("radio", {
      name: /家族A/,
    }) as HTMLInputElement;
    fireEvent.click(selectedChart);
    fireEvent.click(
      screen.getByRole("button", { name: "JSONファイルに書き出す" }),
    );

    await waitFor(() => expect(saveJsonFile).toHaveBeenCalled());
    expect(screen.queryByText(/書き出しました/)).toBeNull();
    expect(selectedChart.checked).toBe(true);
    expect(
      screen.getByRole("button", {
        name: "バックアップする相関図の選択をキャンセル",
      }),
    ).toBeTruthy();
  });

  it("失敗時にエラーを表示し、操作を再開できる", async () => {
    vi.mocked(api.createChartBackup).mockRejectedValue(new Error("保存失敗"));
    renderPage();
    await startBackupSelection();
    fireEvent.click(screen.getByRole("radio", { name: /家族A/ }));
    const exportButton = screen.getByRole("button", {
      name: "JSONファイルに書き出す",
    }) as HTMLButtonElement;
    fireEvent.click(exportButton);

    expect(await screen.findByRole("alert")).toBeTruthy();
    await waitFor(() => expect(exportButton.disabled).toBe(false));
  });

  it("カードのJSONアイコンを表示しない", async () => {
    renderPage();
    await screen.findByText("家族A");
    expect(screen.queryByRole("button", { name: /家族AをJSON/ })).toBeNull();
  });

  it("選択をキャンセルすると通常のカード操作に戻る", async () => {
    renderPage();
    await startBackupSelection();
    expect(screen.queryByRole("button", { name: "家族Aを開く" })).toBeNull();
    expect(screen.queryByRole("button", { name: "家族Aを削除" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(screen.queryByRole("radio", { name: /家族A/ })).toBeNull();
    expect(screen.getByRole("button", { name: "家族Aを開く" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "家族Aを削除" })).toBeTruthy();
  });

  it("通常時のカードクリックで編集画面へ移動する", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "家族Aを開く" }));
    expect(screen.getByTestId("location").textContent).toBe("/charts/chart-a");
  });

  it("相関図が無い場合はバックアップ操作を無効化する", async () => {
    vi.mocked(api.charts).mockResolvedValue([]);
    renderPage();
    await screen.findByText("最初の相関図を作成");
    const backupButton = screen.getByRole("button", {
      name: "相関図を選択してバックアップ",
    }) as HTMLButtonElement;
    expect(backupButton.disabled).toBe(true);
    expect(
      screen.queryByText("バックアップする相関図を選択してください"),
    ).toBeNull();
  });
});
