import { registerSW } from "virtual:pwa-register";

/**
 * Service Worker の登録。
 *
 * v2 系では一時的に配信していた Service Worker を起動時に解除していたが、
 * PWA 化した v3 では自前の Worker と衝突するため廃止した。
 * 古い Worker は同一スコープで上書き登録されるため、明示的な解除は不要。
 *
 * registerType は "prompt"。編集中に勝手に更新されると入力が失われ得るので、
 * 更新は利用者が明示的に選んだときだけ適用する。
 */
export type UpdateHandler = (applyUpdate: () => void) => void;

export function setupServiceWorker(onUpdateAvailable: UpdateHandler): void {
  if (import.meta.env.DEV) return;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => onUpdateAvailable(() => void updateSW(true)),
  });
}
