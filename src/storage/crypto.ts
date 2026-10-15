import { ApiError } from "../api/errors";
import { BACKUP_FORMAT, BACKUP_VERSION } from "./backupModel";

/**
 * バックアップファイルの暗号化。
 *
 * 対象をエクスポートファイルに限っているのは、これがアプリの管理外に出る
 * 唯一のデータだから (USB や共有フォルダに置かれる)。
 *
 * IndexedDB 全体は暗号化しない。鍵をメモリに持つ以上 XSS が成立した時点で
 * 鍵ごと奪われるため XSS 対策にならず、起動のたびのパスフレーズ入力が
 * 非エンジニアの利用者にとって離脱要因になる。詳細は
 * docs/architecture-decisions.md を参照。
 */
export const KDF_ITERATIONS = 600_000;
/**
 * 復号時に受け入れる反復回数の上限。ファイル側の値で処理時間が決まるため、
 * 細工されたファイルで取り込みを延々と止められないように制限する。
 */
export const KDF_ITERATIONS_MAX = 2_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedBackupFile {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  encrypted: true;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  iv: string;
  ciphertext: string;
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const subtle = () => {
  const api = globalThis.crypto?.subtle;
  if (!api)
    throw new ApiError(
      500,
      "CRYPTO_UNAVAILABLE",
      "この環境では暗号化を利用できません。HTTPSで開いているか確認してください。",
    );
  return api;
};

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
) {
  const material = await subtle().importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, hash: "SHA-256", iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBackup(
  json: string,
  passphrase: string,
): Promise<EncryptedBackupFile> {
  if (!passphrase)
    throw new ApiError(
      422,
      "PASSPHRASE_REQUIRED",
      "パスフレーズを入力してください",
    );
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const ciphertext = await subtle().encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(json),
  );
  return {
    // format と version は平文のまま持たせる。
    // 読み込み時に「暗号化されている」と判別してパスフレーズを尋ねるため。
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    encrypted: true,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: KDF_ITERATIONS,
      salt: toBase64(salt),
    },
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export const isEncryptedBackup = (
  value: unknown,
): value is EncryptedBackupFile =>
  typeof value === "object" &&
  value !== null &&
  (value as Record<string, unknown>).encrypted === true;

export async function decryptBackup(
  file: EncryptedBackupFile,
  passphrase: string,
): Promise<string> {
  if (!passphrase)
    throw new ApiError(
      422,
      "PASSPHRASE_REQUIRED",
      "パスフレーズを入力してください",
    );
  const invalid = () =>
    new ApiError(
      422,
      "BACKUP_INVALID",
      "バックアップファイルの内容が壊れています。",
    );
  const iterations: unknown = file.kdf?.iterations;
  if (
    typeof iterations !== "number" ||
    !Number.isInteger(iterations) ||
    iterations <= 0 ||
    iterations > KDF_ITERATIONS_MAX
  )
    throw invalid();
  let salt: Uint8Array;
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    salt = fromBase64(file.kdf.salt);
    iv = fromBase64(file.iv);
    ciphertext = fromBase64(file.ciphertext);
  } catch {
    throw invalid();
  }
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) throw invalid();
  try {
    const key = await deriveKey(passphrase, salt, iterations);
    const plain = await subtle().decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // AES-GCM は改ざんと誤ったパスフレーズを区別できない。どちらも同じ案内にする。
    throw new ApiError(
      422,
      "PASSPHRASE_MISMATCH",
      "パスフレーズが違うか、ファイルが壊れています。",
    );
  }
}
