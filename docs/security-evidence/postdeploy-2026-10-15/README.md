# 公開後再診断の証跡

対象コミット: `25d7fc34260d1c33966f5319f793ceffa0d470f3`。所見・試験範囲は [報告書](../../pentest-postdeploy-2026-10-15.md) を参照。

- `production-results.json`: 本番HTTP 19回とTLS 4回。HEADの `bytes`・hashはcurlで保存したヘッダの値であり、HTTP応答本文のサイズではない。GETのbytes・hashは本文を表す。
- `probe-results.json`: 41ケースの追加モジュール試験。エラーは多くが不正入力を正常に拒否した結果であり、すべてを試験失敗と解釈しない。
- `real-idb-results.txt`・`real-idb-repeat.txt`: 4201・4203での初回・再現試験。最初のロールバック試験はreplaceを使った。P1・P2には障害注入していない。
- `real-idb-merge-rollback.txt`・PNG: 4206での最終試験。最初のケースはmergeの最終書き込みにQuotaExceededErrorを注入し、図・定義がともに変わらないことを確認。後続2ケースでP2・P1を再確認した。
- `R1-*`・`R2-*`・`R3-*`・`R4-*`: 一時利用、他タブ設定、BroadcastChannel無効時のstorage通知、削除保留・解放後の画面。`opens`には観測用のDB保持ボタンの操作も含まれる。
- `cold-editor-*`: P3の読み込み中と描画後。Service Worker登録を止め、エディターチャンクだけ8秒遅延させた隔離環境。
- `xss-*`・`invalid-*`: 架空ファイルのUI取り込み・描画・拒否・元データ保持。
- `sw-*`: 旧版から新版への更新前後。`same-build-sw-update.txt`は同一版の更新確認。
- `baseline-results.json`・`repository-scan.json`: 基礎検証の観測結果要約と秘密情報検査範囲。

`.mjs.txt`・`.js.txt`・`.py.txt` は診断コードの記録で、自動実行されない。`PROJECT_ROOT` は対象リポジトリの絶対パス、`TEMP_AUDIT_DIR` は新しいリポジトリ外の作業先へ置換して使う。Nodeモジュール試験はプロジェクトを作業ディレクトリとして、ローカルViteのSSRローダーから実行した。ブラウザ用store-entryはプロジェクトのesbuildでESM bundleし、ボタンとpreを持つローカルHTMLから読み込んだ。

再実行時は未使用のlocalhostオリジンと使い捨てデータを必ず使う。store-entryは全削除と書き込み競合を意図的に起こす。実利用オリジンへ置かない。serve-slowの第1引数はポート、第2引数ありでChartEditor応答が8秒遅延する。observerの `no-bc=1` はBroadcastChannelを無効化し、`no-sw=1` はService Worker登録を拒否する。

`production.py.txt` は本番への通信を含む記録であり、範囲・実施許可を確認せず再実行しない。今回の実行は合意した上限100件以内で停止し、429・5xx等では中止する設定だった。

各ファイルのSHA-256は `sha256.json`。マニフェスト自身は集計に含めない。診断データはすべて架空であり、実利用データ・認証情報を採取していない。
