import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { Spinner } from "./components/ui";
import AuthPage from "./features/auth/AuthPage";
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
