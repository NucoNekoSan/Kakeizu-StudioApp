/**
 * 新しいバージョンが利用できるようになったことを知らせる小さなバー。
 *
 * React ツリーの外に出しているのは、更新の検出が描画と無関係に起きるため。
 * 依存を増やさずに済ませたい箇所なので DOM を直接組み立てている。
 */
export function showUpdatePrompt(applyUpdate: () => void): void {
  if (document.querySelector(".update-prompt")) return;

  const bar = document.createElement("div");
  bar.className = "update-prompt";
  bar.setAttribute("role", "status");

  const message = document.createElement("span");
  message.textContent = "新しいバージョンがあります。";

  const reload = document.createElement("button");
  reload.type = "button";
  reload.className = "button primary";
  reload.textContent = "更新する";
  reload.addEventListener("click", () => {
    reload.disabled = true;
    dismiss.disabled = true;
    reload.textContent = "更新中…";
    applyUpdate();
  });

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "button";
  dismiss.textContent = "あとで";
  dismiss.addEventListener("click", () => bar.remove());

  bar.append(message, reload, dismiss);
  document.body.append(bar);
}
