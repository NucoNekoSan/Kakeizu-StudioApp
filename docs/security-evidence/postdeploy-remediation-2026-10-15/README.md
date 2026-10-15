# P1〜P3修正後の証跡

[改善記録](../../security-postdeploy-remediation-2026-10-15.md) を参照。すべて架空の使い捨てデータで実施したローカル診断で、本番への操作は含まない。

- `P1-real-idb.txt`: P1だけを修正した段階。削除後の取り込みはSTORAGE_RESET、図は0件。P2はこの時点では未修正でノード1件。
- `P2-real-idb.txt`・PNG: P2まで修正した段階。同時追加のノード2件を保持し、P1の再作成防止・mergeのロールバックも維持。
- `P1-P2-cross-tab.txt`・PNG、`P1-cross-tab-receiver.txt`: 実際の別タブ2枚。同時追加を保持。片方の復号中に他方から全削除し、古い取り込み・古いストアの新規書き込みを拒否。新しいストアでの明示的な再利用は成功。
- `P3-cold-editor.txt`・PNG: 初回エディターの応答を8秒遅延させたproduction build。読み込み中もlastUnloadPreventedがtrue。
- `cross-tab.js.txt`: 実タブ試験の観測コード。PROJECT_ROOTを対象リポジトリの絶対パスに置換し、esbuildでESMとしてbundleして、arm/runボタンとpreを持つローカルHTMLから実行した。新規オリジンで受信タブをARMし、別タブをRUNする。復号開始から10ms後の通知で別タブの全削除を開始する。

観測コードはテスト用で、自動実行されない。実利用オリジンに配置しない。アプリの公開用distには含まれない。`sha256.json` はこの一覧自身を含む各ファイルのハッシュで、マニフェスト自身だけを除外する。
