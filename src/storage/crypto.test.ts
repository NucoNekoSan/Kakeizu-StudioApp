import { describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import {
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
  KDF_ITERATIONS,
} from "./crypto";
import { createMemoryStore } from "./kv";
import { createLocalApi } from "./localApi";

const expectApiError = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await promise.catch((error: ApiError) => expect(error.code).toBe(code));
};

describe("バックアップの暗号化", () => {
  it("暗号文に平文が残らない", async () => {
    const sealed = await encryptBackup('{"secret":"渡辺一郎"}', "合言葉");
    expect(JSON.stringify(sealed)).not.toContain("渡辺一郎");
    expect(sealed.encrypted).toBe(true);
  });

  it("復号すると元の内容に戻る", async () => {
    const json = '{"secret":"渡辺一郎"}';
    const sealed = await encryptBackup(json, "合言葉");
    expect(await decryptBackup(sealed, "合言葉")).toBe(json);
  });

  it("毎回異なる salt と iv を使う", async () => {
    const a = await encryptBackup("{}", "同じ合言葉");
    const b = await encryptBackup("{}", "同じ合言葉");
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("鍵導出の反復回数を十分に取る", async () => {
    const sealed = await encryptBackup("{}", "合言葉");
    expect(sealed.kdf.iterations).toBe(KDF_ITERATIONS);
    expect(KDF_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it("誤ったパスフレーズを拒否する", async () => {
    const sealed = await encryptBackup("{}", "正しい合言葉");
    await expectApiError(
      decryptBackup(sealed, "違う合言葉"),
      "PASSPHRASE_MISMATCH",
    );
  });

  it("改ざんされた暗号文を拒否する", async () => {
    const sealed = await encryptBackup('{"a":1}', "合言葉");
    const tampered = {
      ...sealed,
      ciphertext: sealed.ciphertext.slice(0, -4) + "AAAA",
    };
    await expectApiError(
      decryptBackup(tampered, "合言葉"),
      "PASSPHRASE_MISMATCH",
    );
  });

  it("空のパスフレーズを拒否する", async () => {
    await expectApiError(encryptBackup("{}", ""), "PASSPHRASE_REQUIRED");
  });

  it("平文ファイルは暗号化済みと判定しない", () => {
    expect(isEncryptedBackup({ format: "x", version: 1 })).toBe(false);
  });
});

describe("暗号化バックアップの往復", () => {
  const setup = async () => {
    const api = createLocalApi(createMemoryStore());
    await api.createChart("秘密の相関図");
    return api;
  };

  it("暗号化して書き出し、パスフレーズを渡せば復元できる", async () => {
    const api = await setup();
    const { json, fileName, encrypted } = await api.createBackup("合言葉");
    expect(encrypted).toBe(true);
    expect(fileName).toMatch(/-encrypted\.json$/);
    expect(json).not.toContain("秘密の相関図");

    const other = createLocalApi(createMemoryStore());
    await other.importBackup(json, "replace", "合言葉");
    const charts = await other.charts();
    expect(charts.map((chart) => chart.title)).toEqual(["秘密の相関図"]);
  });

  it("パスフレーズ無しで読み込もうとすると入力を促す", async () => {
    const api = await setup();
    const { json } = await api.createBackup("合言葉");
    const other = createLocalApi(createMemoryStore());
    await expectApiError(other.importBackup(json), "PASSPHRASE_REQUIRED");
  });

  it("暗号化されているかを事前に判定できる", async () => {
    const api = await setup();
    const sealed = await api.createBackup("合言葉");
    const plain = await api.createBackup();
    expect(await api.isEncryptedFile(sealed.json)).toBe(true);
    expect(await api.isEncryptedFile(plain.json)).toBe(false);
  });

  it("暗号化前でも中身の確認ができる", async () => {
    const api = await setup();
    const { json } = await api.createBackup("合言葉");
    const summary = await api.inspectBackup(json, "合言葉");
    expect(summary.titles).toEqual(["秘密の相関図"]);
  });
});
