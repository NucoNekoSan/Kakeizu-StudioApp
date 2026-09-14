/**
 * 保存モード。
 *
 * 共有 PC での利用を想定し、端末に残さない選択肢を用意する。
 * 「今回だけ」を選んだ場合は DocumentStore をインメモリ実装に差し替えるため、
 * IndexedDB へは一切書き込まれない (消し忘れが構造的に起こらない)。
 *
 * sessionStorage を保存先に使わないのは、タブ復元で内容が戻り得るため。
 * ここで sessionStorage に置くのは「モードの選択結果」だけで、相関図は置かない。
 */
export type StorageMode = "persistent" | "session";

export const STORAGE_MODE_KEY = "kakeizu:storage-mode";
/** 全データ削除時にまとめて消すための接頭辞。 */
export const STORAGE_PREFIX = "kakeizu:";

const safeRead = (storage: Storage | undefined, key: string) => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const safeWrite = (
  storage: Storage | undefined,
  key: string,
  value: string,
) => {
  try {
    storage?.setItem(key, value);
  } catch {
    // プライベートウィンドウ等で書けない場合は、選択を覚えないだけで動作は続ける
  }
};

/**
 * ストレージの取得自体が例外を投げる環境がある
 * (プライベートウィンドウやサイトデータをブロックした設定)。
 * 参照を得るところから try で囲む必要がある。
 */
const pick = (get: () => Storage): Storage | undefined => {
  try {
    return get();
  } catch {
    return undefined;
  }
};

const local = () => pick(() => localStorage);
const session = () => pick(() => sessionStorage);

/** 未選択なら null。呼び出し側は初回案内を出す。 */
export function readStorageMode(): StorageMode | null {
  if (safeRead(local(), STORAGE_MODE_KEY) === "persistent") return "persistent";
  if (safeRead(session(), STORAGE_MODE_KEY) === "session") return "session";
  return null;
}

export function writeStorageMode(mode: StorageMode): void {
  if (mode === "persistent") {
    safeWrite(local(), STORAGE_MODE_KEY, "persistent");
    // 端末に残す選択をしたときだけ、ブラウザの自動削除対象から外すよう要求する。
    void navigator.storage?.persist?.().catch(() => false);
    return;
  }
  safeWrite(session(), STORAGE_MODE_KEY, "session");
}

export function clearStorageMode(): void {
  for (const storage of [local(), session()])
    try {
      storage?.removeItem(STORAGE_MODE_KEY);
    } catch {
      // 消せなくても致命的ではない
    }
}

/** `kakeizu:` で始まる localStorage のキーを列挙する (同居データの旧キーを含む)。 */
export function appStorageKeys(
  storage: Storage | undefined = local(),
): string[] {
  try {
    if (!storage) return [];
    return Array.from({ length: storage.length }, (_, index) =>
      storage.key(index),
    ).filter((key): key is string => Boolean(key?.startsWith(STORAGE_PREFIX)));
  } catch {
    return [];
  }
}
