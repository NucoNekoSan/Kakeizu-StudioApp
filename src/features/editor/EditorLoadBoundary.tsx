import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Notice, Shell } from "../../components/ui";
import BackupExportButton from "../backup/BackupExportButton";

/** An unavailable old chunk must not unmount the app and strand temporary data. */
export default class EditorLoadBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Shell backupMode="none">
        <main className="page">
          <Notice tone="error">
            エディターを読み込めませんでした。内容をJSONに書き出してから更新してください。
          </Notice>
          <BackupExportButton />
          <Link to="/charts" className="button">
            一覧へ戻る
          </Link>
        </main>
      </Shell>
    );
  }
}
