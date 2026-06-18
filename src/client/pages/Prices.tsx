import { useState } from "react";
import { Alert, Button, Card } from "@heroui/react";
import type { DashboardResponse } from "@shared/types";
import { formatManYen, formatYen } from "@shared/calc";
import {
  PriceInputTabs,
  type PriceEditTarget,
  type PriceTab,
} from "../components/PriceForms";
import { api } from "../api";

/** 月単価の入力・編集（PRD §8 画面3）。過去月も遡って入力可能。単価は万円単位で入力する。 */
export function Prices({
  dashboard,
  reload,
  error,
}: {
  dashboard: DashboardResponse;
  reload: () => Promise<void>;
  error: string | null;
}) {
  // 単発入力・一括入力のタブ状態と、既存月の「編集」対象を親（このページ）で所有する。
  // 「編集」を押すと単発入力タブへ切り替え、対象を流し込む（PriceInputTabs は制御コンポーネント）。
  const [tab, setTab] = useState<PriceTab>("single");
  const [editTarget, setEditTarget] = useState<PriceEditTarget | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const remove = async (id: string) => {
    if (!confirm("この月の単価を削除しますか？")) return;
    setListError(null);
    try {
      await api.deletePrice(id);
      await reload();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  const editExisting = (yearMonth: string, unitPrice: number) => {
    setTab("single");
    setEditTarget({ yearMonth, unitPrice });
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Card>
        <Card.Header>
          <Card.Title className="text-sm">月単価の入力</Card.Title>
          <Card.Description className="text-xs">
            1ヶ月ずつ入力する「単発入力」と、連続した月にまとめて入れる「一括入力」をタブで切り替えられます。
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <PriceInputTabs
            reload={reload}
            tab={tab}
            onTabChange={setTab}
            editTarget={editTarget}
          />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title className="text-sm">
            登録済みの月単価（{dashboard.prices.length} 件）
          </Card.Title>
        </Card.Header>
        <Card.Content className="space-y-3">
          {listError && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{listError}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          {dashboard.prices.length === 0 ? (
            <p className="text-muted py-6 text-center text-sm">
              まだ登録がありません。上のフォームから入力してください。
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {[...dashboard.prices]
                .sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1))
                .map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div>
                      <span className="font-medium">{p.yearMonth}</span>
                      <span className="ml-3 font-medium">
                        {formatManYen(p.unitPrice)}
                      </span>
                      <span className="text-muted ml-2 text-xs">
                        （{formatYen(p.unitPrice)} 円）
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => editExisting(p.yearMonth, p.unitPrice)}
                      >
                        編集
                      </Button>
                      <Button
                        variant="danger-soft"
                        size="sm"
                        onPress={() => remove(p.id)}
                      >
                        削除
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
