/**
 * 新しいバージョンが利用できるようになったことを知らせる小さなバー。
 *
 * React ツリーの外に出しているのは、更新の検出が描画と無関係に起きるため。
 * 依存を増やさずに済ませたい箇所なので DOM を直接組み立てている。
 */
import { api } from "./api";
import { prepareFileSave, saveJsonFile } from "./storage/fileIo";
import { prepareForUpdate } from "./updatePreparation";
import { getErrorMessage } from "./domain";
import { readStorageMode } from "./storage/storageMode";

const updateErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : getErrorMessage(error);

export function showUpdatePrompt(applyUpdate: () => Promise<void>): void {
  if (document.querySelector(".update-prompt")) return;

  const bar = document.createElement("div");
  bar.className = "update-prompt";
  bar.setAttribute("role", "status");

  const message = document.createElement("span");
  message.textContent =
    "新しいバージョンがあります。一時利用中の内容は更新すると消えます。必要な内容をJSONに書き出してから更新してください。";

  const confirmation = document.createElement("label");
  const acknowledged = document.createElement("input");
  acknowledged.type = "checkbox";
  confirmation.append(acknowledged, "必要な内容を保存・書き出し済みです");
  const feedback = document.createElement("span");
  feedback.setAttribute("role", "status");

  const backup = document.createElement("button");
  backup.type = "button";
  backup.className = "button";
  backup.textContent = "JSONを書き出す";
  backup.addEventListener("click", async () => {
    if (readStorageMode() === null) {
      feedback.textContent = "保存方法を選んでからJSONを書き出してください。";
      return;
    }
    setBusy(true);
    feedback.textContent = "";
    try {
      // Open the picker within the user gesture, before waiting for pending saves.
      const target = await prepareFileSave("kakeizu-before-update.json", {
        description: "JSONバックアップ",
        mimeType: "application/json",
        extension: ".json",
      });
      if (!target) return;
      await prepareForUpdate();
      const { fileName, json } = await api.createBackup();
      await saveJsonFile(fileName, json, target);
      feedback.textContent =
        "JSONを書き出しました。保存した内容を確認してから更新してください。";
    } catch (error) {
      feedback.textContent = updateErrorMessage(error);
    } finally {
      setBusy(false);
    }
  });

  const reload = document.createElement("button");
  reload.type = "button";
  reload.className = "button primary";
  reload.textContent = "更新する";
  reload.disabled = true;
  acknowledged.addEventListener("change", () => {
    reload.disabled = !acknowledged.checked;
  });
  reload.addEventListener("click", async () => {
    if (!acknowledged.checked) return;
    setBusy(true);
    reload.textContent = "更新中…";
    feedback.textContent = "";
    try {
      await applyUpdate();
    } catch (error) {
      feedback.textContent = updateErrorMessage(error);
    } finally {
      // A cancelled beforeunload dialog must not leave the bar unusable.
      setBusy(false);
      reload.textContent = "更新する";
    }
  });

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "button";
  dismiss.textContent = "あとで";
  dismiss.addEventListener("click", () => bar.remove());

  const setBusy = (busy: boolean) => {
    reload.disabled = busy || !acknowledged.checked;
    backup.disabled = busy;
    dismiss.disabled = busy;
    acknowledged.disabled = busy;
  };
  bar.append(message, backup, confirmation, reload, dismiss, feedback);
  document.body.append(bar);
}
