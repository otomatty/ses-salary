import { useCallback, useEffect, useState } from "react";
import type { ApiUser, DashboardResponse } from "@shared/types";
import { api } from "./api";
import { useRoute } from "./router";
import { Spinner } from "./components/ui";
import { Login } from "./pages/Login";
import { Layout } from "./pages/Layout";
import { Home } from "./pages/Home";
import { Prices } from "./pages/Prices";
import { Detail } from "./pages/Detail";
import { Simulate } from "./pages/Simulate";
import { Settings } from "./pages/Settings";

export function App() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashError, setDashError] = useState<string | null>(null);
  const route = useRoute();

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

  if (!authChecked) return <Spinner />;
  if (!user) return <Login onLoggedIn={(u) => setUser(u)} />;

  return (
    <Layout user={user} route={route} onLogout={() => setUser(null)}>
      {!dashboard ? (
        <Spinner />
      ) : route === "prices" ? (
        <Prices dashboard={dashboard} reload={reload} error={dashError} />
      ) : route === "detail" ? (
        <Detail dashboard={dashboard} />
      ) : route === "simulate" ? (
        <Simulate dashboard={dashboard} />
      ) : route === "settings" ? (
        <Settings dashboard={dashboard} reload={reload} />
      ) : (
        <Home dashboard={dashboard} error={dashError} />
      )}
    </Layout>
  );
}
