# 残タスク改善の証跡

[改善・検証記録](../../security-followup-2026-10-15.md) を参照。ローカルの使い捨てオリジンと架空データだけを使用した。本番データ・認証情報・既存ブラウザタブの内容は含めていない。

- `worker-routing.json`: Cloudflareのローカル実行（4220）での最終ビルドの配信8ケース。
- `temporary-before-update.txt`・`update-waiting.*`・`temporary-update-deferred.txt`: 版Aの一時利用と、版Bの待機・更新見送り。
- `backup-before-update.txt`: JSONのBlob、ダウンロード操作開始、アプリ側の完了表示。OSへの保存完了を証明するものではない。
- `temporary-after-other-tab-update.*`・`persistent-after-update.txt`: 更新側だけが版Bへ移り、別タブの版A・一時データ・離脱保護を保持。
- `history-return-after-delete.*`: 別文書への移動中に全削除し、履歴で戻ると保存方法選択へ戻った。pageshow.persistedはfalse。
- `missing-editor-*`: エディターJSを404にした隔離環境（4222）。回復画面からのJSON出力操作、離脱保護、一覧での図の保持。
- `baseline-results.json`: 最終ソースの自動検証結果と、実機検証の限界。

`.mjs.txt`・`.py.txt` は診断コードの記録で自動実行されない。プロジェクトを作業ディレクトリにし、リポジトリ外の新しい作業先・未使用オリジンでのみ実行する。prepare-swは公開用distの複製に観測パネルを追加してWorkerを生成する。release-bはそのHTML識別子を変更してWorkerを再生成する。アプリの保存・保護ロジックを差し替えるものではない。serve-errorはエディターの資材だけを意図的に404にする。

観測パネルはJSONダウンロードへの退避を確認するためFile System Access APIを外している。downloadイベントは取得できず、実ファイルも確認できなかったため、保存ダイアログとOS保存完了は未確認のまま。更新試験のUI記録には中間ビルドを含み、最終ソースは428テストと型検査・lint・整形・buildで確認した。

各ファイルのSHA-256は `sha256.json`（マニフェスト自身を除く）。
