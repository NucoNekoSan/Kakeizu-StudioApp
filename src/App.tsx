import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { Spinner } from "./components/ui";
import AuthPage from "./features/auth/AuthPage";
import HelpPage from "./features/help/HelpPage";
import LegalPage from "./features/legal/LegalPage";
import StorageModeGate from "./features/storage/StorageModeGate";
import ChartsPage from "./features/charts/ChartsPage";
import SettingsPage from "./features/settings/SettingsPage";

const ChartEditor = lazy(() => import("./features/editor/ChartEditor"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
    retry: false,
  });
  if (session.isLoading) return <Spinner />;
  if (session.isError)
    return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <StorageModeGate>
      <Routes>
        {/* 規約・ポリシー・ヘルプは利用開始の判断材料なので、
            保存モードを選ぶ前でも読める必要がある (StorageModeGate が素通しする) */}
        <Route path="/terms" element={<LegalPage slug="terms" />} />
        <Route path="/privacy" element={<LegalPage slug="privacy" />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route
          path="/charts"
          element={
            <RequireAuth>
              <ChartsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/charts/:id"
          element={
            <RequireAuth>
              <Suspense
                fallback={<Spinner label="エディターを読み込んでいます" />}
              >
                <ChartEditor />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/charts" replace />} />
      </Routes>
    </StorageModeGate>
  );
}
