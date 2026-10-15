// @vitest-environment jsdom
import { fireEvent, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { showUpdatePrompt } from "./updatePrompt";
import { api } from "./api";
import { prepareFileSave, saveJsonFile } from "./storage/fileIo";
import { registerUpdatePreparation } from "./updatePreparation";
import { writeStorageMode } from "./storage/storageMode";

vi.mock("./api", async () => ({
  ApiError: (await import("./api/errors")).ApiError,
  api: { createBackup: vi.fn() },
}));
vi.mock("./storage/fileIo", () => ({
  prepareFileSave: vi.fn(),
  saveJsonFile: vi.fn(),
}));
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  localStorage.clear();
  sessionStorage.clear();
  vi.resetAllMocks();
});

it("書き出し確認なしには更新せず、あとでを選ぶと更新しない", () => {
  const apply = vi.fn(async () => {});
  showUpdatePrompt(apply);
  showUpdatePrompt(apply);
  expect(screen.getAllByRole("button", { name: "更新する" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "更新する" }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "あとで" }));
  expect(screen.queryByRole("button", { name: "更新する" })).toBeNull();
  expect(apply).not.toHaveBeenCalled();
});

it("明示的な確認後だけ更新し、失敗・再読み込み取消後も再試行できる", async () => {
  const apply = vi
    .fn()
    .mockRejectedValueOnce(new Error("保存できません"))
    .mockResolvedValue(undefined);
  showUpdatePrompt(apply);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "更新する" }));
  await screen.findByText("保存できません");
  expect(
    (screen.getByRole("button", { name: "更新する" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "更新する" }));
  await waitFor(() => expect(apply).toHaveBeenCalledTimes(2));
});

it("保存先選択→保留中の編集保存→バックアップ取得の順で退避し、取り消しでは出力しない", async () => {
  writeStorageMode("session");
  const order: string[] = [];
  const target = { save: vi.fn() };
  vi.mocked(prepareFileSave).mockImplementation(async () => {
    order.push("picker");
    return target;
  });
  vi.mocked(api.createBackup).mockImplementation(async () => {
    order.push("backup");
    return { fileName: "fixture.json", json: "{}" } as Awaited<
      ReturnType<typeof api.createBackup>
    >;
  });
  vi.mocked(saveJsonFile).mockResolvedValue(true);
  const stop = registerUpdatePreparation(async () => {
    order.push("flush");
  });
  try {
    showUpdatePrompt(vi.fn(async () => {}));
    fireEvent.click(screen.getByRole("button", { name: "JSONを書き出す" }));
    await screen.findByText(/JSONを書き出しました/);
    expect(order).toEqual(["picker", "flush", "backup"]);
    expect(saveJsonFile).toHaveBeenCalledWith("fixture.json", "{}", target);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      false,
    );
    vi.mocked(prepareFileSave).mockResolvedValue(null);
    fireEvent.click(screen.getByRole("button", { name: "JSONを書き出す" }));
    await waitFor(() => expect(prepareFileSave).toHaveBeenCalledTimes(2));
    expect(api.createBackup).toHaveBeenCalledTimes(1);
  } finally {
    stop();
  }
});

it("保存方法が未選択なら、更新バーからストアや保存先選択を開かない", () => {
  showUpdatePrompt(vi.fn(async () => {}));
  fireEvent.click(screen.getByRole("button", { name: "JSONを書き出す" }));
  expect(
    screen.getByText("保存方法を選んでからJSONを書き出してください。"),
  ).toBeDefined();
  expect(api.createBackup).not.toHaveBeenCalled();
  expect(prepareFileSave).not.toHaveBeenCalled();
});
