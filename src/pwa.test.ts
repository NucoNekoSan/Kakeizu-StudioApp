// @vitest-environment jsdom
import type { RegisterSWOptions } from "vite-plugin-pwa/types";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setupServiceWorker, type UpdateHandler } from "./pwa";
import { registerUpdatePreparation } from "./updatePreparation";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  update: vi.fn(async () => {}),
}));
vi.mock("virtual:pwa-register", () => ({ registerSW: mocks.register }));
beforeEach(() => {
  vi.stubEnv("DEV", false);
  mocks.register.mockReset().mockReturnValue(mocks.update);
  mocks.update.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
const options = () => mocks.register.mock.calls[0][0] as RegisterSWOptions;

it("更新の到着と他タブでの有効化は通知だけで、更新要求を送らない", () => {
  const offer = vi.fn<UpdateHandler>();
  setupServiceWorker(offer);
  options().onNeedRefresh?.();
  options().onNeedReload?.();
  expect(offer).toHaveBeenCalledTimes(2);
  expect(mocks.update).not.toHaveBeenCalled();
});

it("編集の保存に失敗した場合はWorkerの更新を開始しない", async () => {
  const offer = vi.fn<UpdateHandler>();
  const stop = registerUpdatePreparation(async () => {
    throw new Error("保存失敗");
  });
  try {
    setupServiceWorker(offer);
    options().onNeedRefresh?.();
    await expect(offer.mock.calls[0][0]()).rejects.toThrow("保存失敗");
    expect(mocks.update).not.toHaveBeenCalled();
  } finally {
    stop();
  }
});

it("編集の保存完了まで更新要求を送らず、有効化されなければ再試行可能な失敗にする", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const stop = registerUpdatePreparation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  try {
    const offer = vi.fn<UpdateHandler>();
    setupServiceWorker(offer);
    options().onNeedRefresh?.();
    const pending = offer.mock.calls[0][0]();
    const rejected =
      expect(pending).rejects.toThrow("更新を完了できませんでした");
    expect(mocks.update).not.toHaveBeenCalled();
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.update).toHaveBeenCalledWith(true);
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
  } finally {
    stop();
  }
});
