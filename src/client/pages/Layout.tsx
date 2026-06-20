import { Link, Outlet } from "@tanstack/react-router";
import type { ApiUser } from "@shared/types";
import { api } from "../api";
import { ThemeToggle } from "../components/ThemeToggle";
import { UserMenu } from "../components/UserMenu";

/** 認証後の共通レイアウト。ヘッダー＋メイン＋フッター。 */
export function Layout({
  user,
  onLogout,
}: {
  user: ApiUser;
  onLogout: () => void;
}) {
  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      onLogout();
    }
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="bg-surface/80 border-border sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-base font-bold">
            エンジニア給与計算
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu user={user} onLogout={handleLogout} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
