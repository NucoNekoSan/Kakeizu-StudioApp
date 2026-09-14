/**
 * ブラウザでのファイル保存・読み込み。
 * JSON バックアップと PNG 書き出しの両方から使う。
 *
 * File System Access API は Firefox / Safari が非対応のため単独では使えない。
 * 機能があれば「保存先を選ぶ」体験にし、無ければ `<a download>` にフォールバックする。
 */
type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{
  createWritable(): Promise<{
    write(data: Blob): Promise<void>;
    close(): Promise<void>;
  }>;
}>;

const picker = (): SaveFilePicker | null =>
  typeof window !== "undefined" && "showSaveFilePicker" in window
    ? (window as unknown as { showSaveFilePicker: SaveFilePicker })
        .showSaveFilePicker
    : null;

/**
 * Blob を参照できる URL にする。
 * `URL.createObjectURL` が無い環境 (一部の埋め込み WebView やテスト環境) では
 * data URL へフォールバックする。
 */
const toDownloadUrl = (blob: Blob): Promise<string> =>
  typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
    ? Promise.resolve(URL.createObjectURL(blob))
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

const downloadViaAnchor = async (fileName: string, blob: Blob) => {
  const url = await toDownloadUrl(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // revoke が早すぎると保存が始まらないブラウザがあるため次のタスクへ回す。
  if (url.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** `canvas.toDataURL()` の結果を Blob にする (jsdom に toBlob が無いため)。 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(encoded ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

export interface SaveFileOptions {
  description?: string;
  mimeType?: string;
  extension?: string;
}

/**
 * ファイルを保存する。利用者がダイアログで取り消した場合は false を返す
 * (呼び出し側がエラー表示をしないようにするため)。
 */
export async function saveFile(
  fileName: string,
  blob: Blob,
  options: SaveFileOptions = {},
): Promise<boolean> {
  const showSaveFilePicker = picker();
  if (showSaveFilePicker) {
    try {
      const handle = await showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: options.description ?? "ファイル",
            accept: {
              [options.mimeType ?? blob.type ?? "application/octet-stream"]: [
                options.extension ?? `.${fileName.split(".").pop()}`,
              ],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        return false;
      // 権限エラーなどで picker が使えない環境ではフォールバックする。
    }
  }
  await downloadViaAnchor(fileName, blob);
  return true;
}

export const saveJsonFile = (fileName: string, json: string) =>
  saveFile(fileName, new Blob([json], { type: "application/json" }), {
    description: "JSONファイル",
    mimeType: "application/json",
    extension: ".json",
  });

/** `<input type="file">` から読み込む。全ブラウザで動くので分岐は不要。 */
export const readTextFile = (file: File): Promise<string> => file.text();
