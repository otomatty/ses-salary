import { useState } from "react";
import type { ApiUser } from "@shared/types";
import { api } from "../api";
import { Button, Card, ErrorBanner } from "../components/ui";

/** ログイン画面（PRD §8 画面1）。Google SSO。開発時は簡易ログインも可能。 */
export function Login({ onLoggedIn }: { onLoggedIn: (u: ApiUser) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 開発用ログインは本番ビルドでは表示しない
  const showDevLogin = import.meta.env.DEV;

  const handleDevLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.devLogin();
      const me = await api.me();
      if (me.user) onLoggedIn(me.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-indigo-50 px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">SES 給与計算</h1>
          <p className="mt-1 text-sm text-slate-500">
            単価連動型の給与を計算・予測・可視化
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <a href="/auth/login" className="block">
          <Button className="w-full" variant="primary">
            Google でログイン
          </Button>
        </a>

        {showDevLogin && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Button
              className="w-full"
              variant="secondary"
              onClick={handleDevLogin}
              disabled={loading}
            >
              {loading ? "ログイン中…" : "開発用ログイン"}
            </Button>
            <p className="mt-2 text-center text-xs text-slate-400">
              ローカル開発専用（本番では表示されません）
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          自分のデータのみ閲覧・編集できます。
        </p>
      </Card>
    </div>
  );
}
