import type { ReactNode } from "react";
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
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate("home")}
            className="text-base font-bold text-slate-900"
          >
            SES 給与計算
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {user.name}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              ログアウト
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 px-2">
          {NAV.map((item) => (
            <button
              key={item.route}
              onClick={() => navigate(item.route)}
              className={`relative px-3 py-2 text-sm font-medium transition ${
                route === item.route
                  ? "text-indigo-600"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {item.label}
              {route === item.route && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-indigo-600" />
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>

      <footer className="mx-auto max-w-3xl px-4 py-8 text-center text-xs text-slate-400">
        本アプリは額面（総支給）の計算・予測・可視化に特化しています。
        手取り・控除は含みません。
      </footer>
    </div>
  );
}
