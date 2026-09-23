// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { readTextFile } from "../../storage/fileIo";
import BackupImportControl from "./BackupImportControl";

vi.mock("../../api", () => ({
  api: { importBackup: vi.fn(), isEncryptedFile: vi.fn() },
  ApiError: class ApiError extends Error {},
}));
vi.mock("../../storage/fileIo", () => ({ readTextFile: vi.fn() }));

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderControl(path = "/charts/one") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <BackupImportControl />
                <Location />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function chooseFile() {
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [new File(["{}"], "backup.json")] },
  });
  await screen.findByText("バックアップを読み込む");
}

describe("BackupImportControl", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("追加後は編集中の画面に留まる", async () => {
    vi.mocked(readTextFile).mockResolvedValue("{}");
    vi.mocked(api.isEncryptedFile).mockResolvedValue(false);
    vi.mocked(api.importBackup).mockResolvedValue({
      mode: "merge",
      importedCharts: 2,
      renamedCharts: 0,
      addedDefinitions: 0,
    });
    renderControl();
    await chooseFile();
    fireEvent.click(screen.getByRole("button", { name: "読み込む" }));
    await waitFor(() =>
      expect(api.importBackup).toHaveBeenCalledWith("{}", "merge", undefined),
    );
    expect(screen.getByTestId("location").textContent).toBe("/charts/one");
  });

  it("置き換え後は一覧へ移動する", async () => {
    vi.mocked(readTextFile).mockResolvedValue("{}");
    vi.mocked(api.isEncryptedFile).mockResolvedValue(false);
    vi.mocked(api.importBackup).mockResolvedValue({
      mode: "replace",
      importedCharts: 1,
      renamedCharts: 0,
      addedDefinitions: 0,
    });
    renderControl();
    await chooseFile();
    fireEvent.click(screen.getByLabelText(/置き換える/));
    fireEvent.click(screen.getByRole("button", { name: "読み込む" }));
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/charts"),
    );
  });

  it("暗号化ファイルではパスフレーズを渡す", async () => {
    vi.mocked(readTextFile).mockResolvedValue("encrypted");
    vi.mocked(api.isEncryptedFile).mockResolvedValue(true);
    vi.mocked(api.importBackup).mockResolvedValue({
      mode: "merge",
      importedCharts: 1,
      renamedCharts: 0,
      addedDefinitions: 0,
    });
    renderControl();
    await chooseFile();
    fireEvent.change(screen.getByLabelText("パスフレーズ"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "読み込む" }));
    await waitFor(() =>
      expect(api.importBackup).toHaveBeenCalledWith(
        "encrypted",
        "merge",
        "secret",
      ),
    );
  });
});
