import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Spinner } from "./components/ui";
import HelpPage from "./features/help/HelpPage";
import LegalPage from "./features/legal/LegalPage";
import StorageModeGate from "./features/storage/StorageModeGate";
import ChartsPage from "./features/charts/ChartsPage";
import SettingsPage from "./features/settings/SettingsPage";

const ChartEditor = lazy(() => import("./features/editor/ChartEditor"));

/**
 * 認証は行わない。サーバーを持たず、データは利用者の端末内にのみ存在するため、
 * 守るべき境界がアプリ側に無い（docs/architecture-decisions.md ADR-001）。
 * 起動時の分岐は StorageModeGate（保存先の選択）が担う。
 */
export default function App() {
  return (
    <StorageModeGate>
      <Routes>
        {/* 規約・ポリシー・ヘルプは利用開始の判断材料なので、
            保存モードを選ぶ前でも読める必要がある (StorageModeGate が素通しする) */}
        <Route path="/terms" element={<LegalPage slug="terms" />} />
        <Route path="/privacy" element={<LegalPage slug="privacy" />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/charts" element={<ChartsPage />} />
        <Route
          path="/charts/:id"
          element={
            <Suspense
              fallback={<Spinner label="エディターを読み込んでいます" />}
            >
              <ChartEditor />
            </Suspense>
          }
        />
        <Route path="/settings" element={<SettingsPage />} />
        {/* 廃止した /login を含め、未知のパスは一覧へ送る */}
        <Route path="*" element={<Navigate to="/charts" replace />} />
      </Routes>
    </StorageModeGate>
  );
}
