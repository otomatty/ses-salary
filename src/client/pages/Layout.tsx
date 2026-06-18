import type { ReactNode } from "react";
import { Button, Tabs } from "@heroui/react";
import type { ApiUser } from "@shared/types";
import { api } from "../api";
import { navigate, type Route } from "../router";

const NAV: { route: Route; label: string }[] = [
  { route: "home", label: "ホーム" },
  { route: "prices", label: "月単価" },
  { route: "detail", label: "計算根拠" },
  { route: "simulate", label: "試算" },
  { route: "settings", label: "設定" },
];

/** 認証後の共通レイアウト。ヘッダー＋ナビゲーション。 */
export function Layout({
  user,
  route,
  onLogout,
  children,
}: {
  user: ApiUser;
  route: Route;
  onLogout: () => void;
  children: ReactNode;
}) {
  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      onLogout();
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-surface/80 border-border sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" onPress={() => navigate("home")}>
            <span className="text-base font-bold">エンジニア給与計算</span>
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-muted hidden text-sm sm:inline">
              {user.name}
            </span>
            <Button variant="ghost" size="sm" onPress={handleLogout}>
              ログアウト
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-2">
          <Tabs
            selectedKey={route}
            onSelectionChange={(key) => navigate(key as Route)}
          >
            <Tabs.List>
              {NAV.map((item) => (
                <Tabs.Tab key={item.route} id={item.route}>
                  {item.label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>

      <footer className="text-muted mx-auto max-w-3xl px-4 py-8 text-center text-xs">
        本アプリは額面（総支給）の計算・予測・可視化に特化しています。
        手取り・控除は含みません。
      </footer>
    </div>
  );
}
