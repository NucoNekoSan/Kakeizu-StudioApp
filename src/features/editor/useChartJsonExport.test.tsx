// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { ApiError } from "../../api/errors";
import { buildBackup } from "../../storage/backupModel";
import { prepareFileSave, saveJsonFile } from "../../storage/fileIo";
import { useChartJsonExport } from "./useChartJsonExport";

vi.mock("../../api", async () => ({
  api: { createChartBackup: vi.fn() },
  ApiError: (await import("../../api/errors")).ApiError,
}));
vi.mock("../../storage/fileIo", () => ({
  prepareFileSave: vi.fn(),
  saveJsonFile: vi.fn(),
}));

const target = { save: vi.fn(async () => undefined) };
function options() {
  return {
    chartId: "chart",
    title: "Stored",
    draftTitle: "  Draft  ",
    beforeExport: vi.fn<() => Promise<void>>(async () => undefined),
    announce: vi.fn(),
    onSaved: vi.fn(),
  };
}

beforeEach(() => {
  vi.mocked(prepareFileSave).mockResolvedValue(target);
  vi.mocked(api.createChartBackup).mockResolvedValue({
    fileName: "saved.json",
    json: "{}",
    backup: buildBackup(
      { schemaVersion: 1, relationships: [], genders: [] },
      [],
      "test",
    ),
  });
  vi.mocked(saveJsonFile).mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("chart JSON export lifecycle", () => {
  it("opens the picker during the click and waits for pending writes before reading the backup", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const callbacks = options();
    callbacks.beforeExport.mockReturnValue(gate);
    const { result } = renderHook(() => useChartJsonExport(callbacks));
    let exporting!: Promise<void>;
    act(() => {
      exporting = result.current.exportCurrentChart();
      expect(prepareFileSave).toHaveBeenCalledOnce();
      expect(callbacks.beforeExport).not.toHaveBeenCalled();
    });
    await waitFor(() => expect(callbacks.beforeExport).toHaveBeenCalledOnce());
    expect(result.current.isJsonExporting).toBe(true);
    expect(api.createChartBackup).not.toHaveBeenCalled();
    await act(async () => {
      release();
      await exporting;
    });
    expect(prepareFileSave).toHaveBeenCalledWith(
      expect.stringContaining("Draft"),
      expect.objectContaining({ mimeType: "application/json" }),
    );
    expect(saveJsonFile).toHaveBeenCalledWith("saved.json", "{}", target);
    expect(callbacks.announce).toHaveBeenCalledWith(
      "saved.json を書き出しました。",
    );
    expect(callbacks.onSaved).toHaveBeenCalledOnce();
    expect(result.current.isJsonExporting).toBe(false);
  });

  it("cancelling the picker skips pending writes, backup reads and completion notifications", async () => {
    vi.mocked(prepareFileSave).mockResolvedValue(null);
    const callbacks = options();
    const { result } = renderHook(() => useChartJsonExport(callbacks));
    await act(() => result.current.exportCurrentChart());
    expect(callbacks.beforeExport).not.toHaveBeenCalled();
    expect(api.createChartBackup).not.toHaveBeenCalled();
    expect(saveJsonFile).not.toHaveBeenCalled();
    expect(callbacks.announce).not.toHaveBeenCalled();
    expect(callbacks.onSaved).not.toHaveBeenCalled();
    expect(result.current.isJsonExporting).toBe(false);
  });

  it("does not report completion when saving returns false", async () => {
    vi.mocked(saveJsonFile).mockResolvedValue(false);
    const callbacks = options();
    const { result } = renderHook(() => useChartJsonExport(callbacks));
    await act(() => result.current.exportCurrentChart());
    expect(callbacks.announce).not.toHaveBeenCalled();
    expect(callbacks.onSaved).not.toHaveBeenCalled();
    expect(result.current.isJsonExporting).toBe(false);
  });

  it.each(["picker", "pending-write", "backup", "save"] as const)(
    "reports %s failures and clears the busy state",
    async (stage) => {
      const callbacks = options();
      const error = new ApiError(503, "TEST_FAILURE", "failure");
      if (stage === "picker")
        vi.mocked(prepareFileSave).mockRejectedValue(error);
      if (stage === "pending-write")
        callbacks.beforeExport.mockRejectedValue(error);
      if (stage === "backup")
        vi.mocked(api.createChartBackup).mockRejectedValue(error);
      if (stage === "save") vi.mocked(saveJsonFile).mockRejectedValue(error);
      const { result } = renderHook(() => useChartJsonExport(callbacks));
      await act(() => result.current.exportCurrentChart());
      expect(callbacks.announce).toHaveBeenCalledWith(
        "JSONファイルを書き出せませんでした。failure",
      );
      expect(callbacks.onSaved).not.toHaveBeenCalled();
      expect(result.current.isJsonExporting).toBe(false);
      if (stage === "picker" || stage === "pending-write")
        expect(api.createChartBackup).not.toHaveBeenCalled();
      if (stage !== "save") expect(saveJsonFile).not.toHaveBeenCalled();
    },
  );
});
