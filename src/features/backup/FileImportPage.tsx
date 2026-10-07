import { Notice, Shell } from "../../components/ui";
import BackupImportControl from "./BackupImportControl";

export default function FileImportPage() {
  return (
    <Shell>
      <main className="page settings-page">
        <div className="page-head" data-tutorial-target="file-import-heading">
          <div>
            <span className="eyebrow">FILE IMPORT</span>
            <h1>ファイル読み込み</h1>
            <p>
              バックアップ用のJSONファイルから相関図と表示設定を読み込みます。
            </p>
          </div>
          <BackupImportControl />
        </div>
        <Notice tone="info">
          読み込むファイルを選択した後、現在のデータに追加するか、ファイルの内容で置き換えるかを選択できます。
        </Notice>
      </main>
    </Shell>
  );
}
