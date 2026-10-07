import { Shell } from "../../components/ui";
import BackupPanel from "./BackupPanel";

export default function DataManagementPage() {
  return (
    <Shell>
      <main className="page settings-page">
        <div
          className="page-head"
          data-tutorial-target="data-management-heading"
        >
          <div>
            <span className="eyebrow">DATA MANAGEMENT</span>
            <h1>データ管理</h1>
            <p>保存方法と、この端末に保存されたデータを管理します。</p>
          </div>
        </div>
        <BackupPanel />
      </main>
    </Shell>
  );
}
