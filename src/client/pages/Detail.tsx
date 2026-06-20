import { Button, Card } from "@heroui/react";
import type { DashboardResponse } from "@shared/types";
import { SalaryBreakdownCard } from "../components/SalaryBreakdownCard";
import { MonthlyIncomeDetail } from "../components/MonthlyIncomeDetail";
import { RateTableCard } from "../components/RateTableCard";
import { useNavigate } from "@tanstack/react-router";

/**
 * 給与の詳細（PRD §8 画面4）。
 * 四半期の計算根拠（帯・ランク・率・式）を主役に、月次の実支給内訳と
 * 早見表マスタを併せて一画面で確認できる。
 */
export function Detail({ dashboard }: { dashboard: DashboardResponse }) {
  const navigate = useNavigate();
  const hasAny = dashboard.current || dashboard.next;

  return (
    <div className="space-y-6">
      {/* 基本給の計算根拠（主役） */}
      {!hasAny ? (
        <Card>
          <Card.Content className="py-6 text-center text-sm">
            <p className="text-muted">
              計算根拠を表示するには、前四半期（3ヶ月）の月単価が必要です。
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onPress={() => navigate({ to: "/prices" })}
            >
              月単価を入力する →
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dashboard.current && (
            <SalaryBreakdownCard title="今期の給与" result={dashboard.current} />
          )}
          {dashboard.next && (
            <SalaryBreakdownCard
              title="来期の給与（予測）"
              result={dashboard.next}
            />
          )}
        </div>
      )}

      {/* 月次の実支給（基本給 + 手当 + 残業代） */}
      <MonthlyIncomeDetail dashboard={dashboard} />

      {/* 早見表マスタ */}
      <RateTableCard />
    </div>
  );
}
