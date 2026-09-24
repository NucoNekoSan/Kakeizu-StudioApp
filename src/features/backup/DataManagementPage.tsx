import { Shell } from "../../components/ui";
import BackupImportControl from "./BackupImportControl";
import BackupPanel from "./BackupPanel";

export default function DataManagementPage() {
  return (
    <Shell>
      <main className="page settings-page">
        <div className="page-head">
          <div>
            <span className="eyebrow">DATA MANAGEMENT</span>
            <h1>データ管理</h1>
            <p>バックアップの読み書き、保存方法、端末内データを管理します。</p>
          </div>
          <BackupImportControl />
        </div>
        <BackupPanel />
      </main>
    </Shell>
  );
}
