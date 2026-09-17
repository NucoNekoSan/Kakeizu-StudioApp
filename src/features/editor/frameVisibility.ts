import { readStorageMode } from "../../storage/storageMode";

const VISIBILITY_KEY = "kakeizu:frame-visible";
let sessionVisible = false;
export function readFrameVisibility(): boolean {
  if (readStorageMode() !== "persistent") return sessionVisible;
  try {
    return localStorage.getItem(VISIBILITY_KEY) === "true";
  } catch {
    return false;
  }
}
export function writeFrameVisibility(visible: boolean): void {
  if (readStorageMode() !== "persistent") {
    sessionVisible = visible;
    return;
  }
  try {
    localStorage.setItem(VISIBILITY_KEY, String(visible));
  } catch {
    /* 設定保存ができなくても画面操作を続ける */
  }
}
