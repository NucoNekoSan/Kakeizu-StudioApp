import { registerSW } from "virtual:pwa-register";
import { prepareForUpdate } from "./updatePreparation";

/**
 * Service Worker の登録。
 *
 * v2 系では一時的に配信していた Service Worker を起動時に解除していたが、
 * PWA 化した v3 では自前の Worker と衝突するため廃止した。
 * 古い Worker は同一スコープで上書き登録されるため、明示的な解除は不要。
 *
 * 更新待ち・別タブによる有効化のどちらでも、作業中の画面を自動再読み込みしない。
 */
export type UpdateHandler = (applyUpdate: () => Promise<void>) => void;

const checkForUpdate = (registration: ServiceWorkerRegistration): void => {
  void registration.update().catch((error: unknown) => {
    console.warn("Service Worker の更新確認に失敗しました。", error);
  });
};

export function setupServiceWorker(onUpdateAvailable: UpdateHandler): void {
  if (import.meta.env.DEV) return;
  let activated = false;
  let registration: ServiceWorkerRegistration | undefined;
  let activationComplete: (() => void) | undefined;
  const offerUpdate = () =>
    onUpdateAvailable(async () => {
      await prepareForUpdate();
      // A suspended tab may miss the activation event from another tab.
      if (registration && !registration.waiting && !registration.installing)
        activated = true;
      if (!activated) {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            activationComplete = undefined;
            reject(
              new Error(
                "更新を完了できませんでした。通信を確認して、もう一度お試しください。",
              ),
            );
          }, 15_000);
          activationComplete = () => {
            window.clearTimeout(timer);
            activationComplete = undefined;
            resolve();
          };
          void updateSW(true).catch((error: unknown) => {
            window.clearTimeout(timer);
            activationComplete = undefined;
            reject(error);
          });
        });
      }
      window.location.reload();
    });
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: offerUpdate,
    onNeedReload: () => {
      activated = true;
      // Another tab can activate the worker, but cannot consent to this tab's reload.
      if (activationComplete) activationComplete();
      else offerUpdate();
    },
    onRegisteredSW: (_scriptUrl, registered) => {
      if (!registered) return;
      registration = registered;

      // ブラウザ任せの更新間隔を待たず、起動時に最新版を確認する。
      checkForUpdate(registered);

      // インストール済みPWAを長時間開いたままにしていても、画面へ戻った時や
      // オンライン復帰時に更新通知へ到達できるようにする。
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate(registered);
      });
      window.addEventListener("online", () => checkForUpdate(registered));
    },
    onRegisterError: (error) => {
      console.warn("Service Worker の登録に失敗しました。", error);
    },
  });
}
