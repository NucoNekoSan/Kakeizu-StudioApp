import { createId, isId } from "./ids";

const RESET_EVENT = "kakeizu:data-cleared";
const RESET_KEY = "kakeizu:data-reset";
const RESET_CHANNEL = "kakeizu-storage-reset-v1";

const openChannel = () => {
  try {
    return typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(RESET_CHANNEL);
  } catch {
    return null;
  }
};

/** 同じオリジンの全タブへ削除完了を通知する。入力内容は送らない。 */
export function publishStorageReset(): void {
  const id = createId();
  const channel = openChannel();
  channel?.postMessage(id);
  channel?.close();
  try {
    localStorage.setItem(RESET_KEY, id);
    localStorage.removeItem(RESET_KEY);
  } catch {
    // localStorage が使えなくても BroadcastChannel と同じ画面には通知する。
  }
  window.dispatchEvent(new CustomEvent(RESET_EVENT, { detail: id }));
}

export function subscribeStorageReset(onReset: () => void): () => void {
  const seen = new Set<string>();
  const accept = (id: unknown) => {
    if (!isId(id) || seen.has(id)) return;
    if (seen.size >= 16) seen.clear();
    seen.add(id);
    onReset();
  };
  const channel = openChannel();
  if (channel) channel.onmessage = (event) => accept(event.data);
  const storage = (event: StorageEvent) => {
    if (event.key === RESET_KEY) accept(event.newValue);
  };
  const local = (event: Event) => accept((event as CustomEvent).detail);
  window.addEventListener("storage", storage);
  window.addEventListener(RESET_EVENT, local);
  return () => {
    channel?.close();
    window.removeEventListener("storage", storage);
    window.removeEventListener(RESET_EVENT, local);
  };
}
