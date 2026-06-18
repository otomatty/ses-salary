import { useCallback, useEffect, useState } from "react";
import { RouterProvider } from "@tanstack/react-router";
import type { ApiUser, DashboardResponse } from "@shared/types";
import { api } from "./api";
import { Spinner } from "@heroui/react";
import { AppProvider } from "./context/AppContext";
import { router } from "./router";
import { Login } from "./pages/Login";

/** アプリのルート。認証状態とダッシュボードデータを管理し、TanStack Router で画面を出し分ける。 */
export function App() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashError, setDashError] = useState<string | null>(null);

  // 認証状態の確認
  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  // ダッシュボードデータの取得
  const reload = useCallback(async () => {
    try {
      const data = await api.dashboard();
      setDashboard(data);
      setDashError(null);
    } catch (e) {
      setDashError(e instanceof Error ? e.message : "読み込みに失敗しました");
    }
  }, []);

  useEffect(() => {
    if (user) reload();
  }, [user, reload]);

  // ユーザー切替時に前セッションのダッシュボードが一瞬残らないよう、
  // ログイン・ログアウトの両方で関連 state を初期化する。
  const handleLoggedIn = (u: ApiUser) => {
    setDashboard(null);
    setDashError(null);
    setUser(u);
  };
  const handleLogout = () => {
    setDashboard(null);
    setDashError(null);
    setUser(null);
  };

  if (!authChecked) return <LoadingScreen />;
  if (!user) return <Login onLoggedIn={handleLoggedIn} />;

  return (
    <AppProvider
      value={{
        user,
        dashboard,
        dashError,
        reload,
        handleLogout,
      }}
    >
      <RouterProvider router={router} />
    </AppProvider>
  );
}

/** 認証確認中・ダッシュボード読込中に表示する中央寄せのスピナー。 */
function LoadingScreen() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}
