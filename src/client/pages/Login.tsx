import { useState } from "react";
import { Alert, Button, Card, Separator } from "@heroui/react";
import type { ApiUser } from "@shared/types";
import { api } from "../api";

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
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <Card.Header className="text-center">
          <Card.Title>エンジニア給与計算</Card.Title>
          <Card.Description>単価連動型の給与を計算・予測・可視化</Card.Description>
        </Card.Header>

        <Card.Content className="space-y-4">
          {error && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          <Button
            fullWidth
            variant="primary"
            onPress={() => {
              window.location.href = "/auth/login";
            }}
          >
            Google でログイン
          </Button>

          {showDevLogin && (
            <div className="space-y-2">
              <Separator />
              <Button
                fullWidth
                variant="secondary"
                onPress={handleDevLogin}
                isDisabled={loading}
              >
                {loading ? "ログイン中…" : "開発用ログイン"}
              </Button>
              <p className="text-muted text-center text-xs">
                ローカル開発専用（本番では表示されません）
              </p>
            </div>
          )}

          <p className="text-muted text-center text-xs">
            自分のデータのみ閲覧・編集できます。
          </p>
        </Card.Content>
      </Card>
    </div>
  );
}
