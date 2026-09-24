import { registerSW } from "virtual:pwa-register";

/**
 * Service Worker の登録。
 *
 * v2 系では一時的に配信していた Service Worker を起動時に解除していたが、
 * PWA 化した v3 では自前の Worker と衝突するため廃止した。
 * 古い Worker は同一スコープで上書き登録されるため、明示的な解除は不要。
 *
 * registerType は "autoUpdate"。古いWorkerが更新待ちのまま残って最新版を
 * 表示できなくなることを防ぐ。onNeedRefresh は移行中のWorker向けの予備導線。
 */
export type UpdateHandler = (applyUpdate: () => void) => void;

const checkForUpdate = (registration: ServiceWorkerRegistration): void => {
  void registration.update().catch((error: unknown) => {
    console.warn("Service Worker の更新確認に失敗しました。", error);
  });
};

export function setupServiceWorker(onUpdateAvailable: UpdateHandler): void {
  if (import.meta.env.DEV) return;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => onUpdateAvailable(() => void updateSW(true)),
    onRegisteredSW: (_scriptUrl, registration) => {
      if (!registration) return;

      // ブラウザ任せの更新間隔を待たず、起動時に最新版を確認する。
      checkForUpdate(registration);

      // インストール済みPWAを長時間開いたままにしていても、画面へ戻った時や
      // オンライン復帰時に更新通知へ到達できるようにする。
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible")
          checkForUpdate(registration);
      });
      window.addEventListener("online", () => checkForUpdate(registration));
    },
    onRegisterError: (error) => {
      console.warn("Service Worker の登録に失敗しました。", error);
    },
  });
}
