import { Alert, Button, Card } from "@heroui/react";
import type {
  AnnualIncomeDTO,
  DashboardResponse,
  MonthlyIncomeDTO,
} from "@shared/types";
import { formatYen } from "@shared/calc";
import { guidanceForStatus } from "@shared/guidance";
import type { SalaryResult } from "@shared/periods";
import {
  findTier,
  unitPriceForMonth,
  TIERS,
  type Tier,
} from "@shared/rateTable";
import { currentYearMonth } from "@shared/periods";
import { LazyTrendChart } from "../components/LazyTrendChart";
import { StatusBadge } from "../components/StatusBadge";
import { StatusGuidance } from "../components/StatusGuidance";
import { useNavigate } from "@tanstack/react-router";

/** ホーム画面（PRD §8 画面2）。推移グラフを主役に、今期・来期サマリを表示。 */
export function Home({
  dashboard,
  error,
}: {
  dashboard: DashboardResponse;
  error: string | null;
}) {
  const navigate = useNavigate();

  // 今月の単価から本人の現在ティアを判定する（今月の単価が未登録なら null）。
  const currentPrice = unitPriceForMonth(
    dashboard.prices,
    currentYearMonth(),
  );
  const tier = currentPrice === null ? null : findTier(currentPrice);

  return (
    <div className="space-y-6">
      {/* 現在のティア（Tech Gold / Silver / Bronze）。今月の単価で判定。 */}
      {tier !== null && currentPrice !== null && (
        <TierHero tier={tier} unitPrice={currentPrice} />
      )}

      {error && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {/* 評価ランク未設定時の明示＋設定画面への誘導（PRD §12.3） */}
      {dashboard.rankProvisional && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Alert.Title>評価ランク未設定（暫定ランク1で計算中）</Alert.Title>
              <Alert.Description>
                人事評価で決まる評価ランクがまだ設定されていません。正確な給与計算のため、設定画面でランクを登録してください。
              </Alert.Description>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onPress={() => navigate({ to: "/settings" })}
            >
              評価ランクを設定 →
            </Button>
          </Alert.Content>
        </Alert>
      )}

      {/* 年収（直近12カ月）。12カ月すべての基本給が揃う場合のみ表示。 */}
      {dashboard.annualIncome && (
        <AnnualIncomeCard annual={dashboard.annualIncome} />
      )}

      {/* 今期・来期サマリ */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          label="今期の給与"
          result={dashboard.current}
          emptyText="今期に適用される給与を計算するには、前四半期（3ヶ月）の単価が必要です。"
          income={dashboard.currentMonthIncome}
        />
        <SummaryCard
          label="来期の給与（予測）"
          result={dashboard.next}
          emptyText={dashboard.nextPending ?? "来期の給与はまだ計算できません。"}
          highlight
        />
      </div>

      {/* 推移グラフ */}
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">単価・給与の推移</Card.Title>
        </Card.Header>
        <Card.Content>
          <LazyTrendChart
            prices={dashboard.prices}
            history={dashboard.history}
          />
        </Card.Content>
      </Card>
    </div>
  );
}

/**
 * 年収（直近12カ月の額面実支給見込み合計）の幅広バナー。
 * 12カ月すべての基本給が算出可能な場合のみ呼ばれる（呼び出し側で判定）。
 */
function AnnualIncomeCard({ annual }: { annual: AnnualIncomeDTO }) {
  return (
    <Card>
      <Card.Content className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted text-sm">年収（直近12ヶ月）</p>
          <p className="mt-0.5 text-3xl font-bold tabular-nums">
            {formatYen(annual.total)}
            <span className="text-muted ml-1 text-base font-normal">円</span>
          </p>
          <p className="text-muted mt-1 text-xs">
            {annual.startMonth} 〜 {annual.endMonth} の実支給見込み合計（手当・残業を含む概算）
          </p>
        </div>
        <p className="text-muted text-xs tabular-nums">
          基本給 {formatYen(annual.totalBaseSalary)}
          {annual.totalAllowance > 0 && (
            <> ＋ 手当 {formatYen(annual.totalAllowance)}</>
          )}
          {annual.totalOvertimePay > 0 && (
            <> ＋ 残業 {formatYen(annual.totalOvertimePay)}</>
          )}{" "}
          円
        </p>
      </Card.Content>
    </Card>
  );
}

/** 現在のティア（Gold / Silver / Bronze）を金・銀・銅のバナーで主張する。 */
function TierHero({ tier, unitPrice }: { tier: Tier; unitPrice: number }) {
  const info = TIERS[tier];
  return (
    <div className="tier-hero" data-tier={tier}>
      <div className="tier-hero__content flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium opacity-90">あなたの現在のランク</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight">{info.label}</p>
          <p className="mt-0.5 text-xs opacity-90">{info.rangeLabel}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs opacity-90">今月の単価</p>
          <p className="text-xl font-bold tabular-nums">
            {formatYen(unitPrice)}
            <span className="ml-1 text-sm font-normal opacity-90">円</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** 今期・来期の給与サマリカード。給与額・ステータス・案内・計算根拠への導線を表示する。 */
function SummaryCard({
  label,
  result,
  emptyText,
  highlight = false,
  income = null,
}: {
  label: string;
  result: SalaryResult | null;
  emptyText: string;
  highlight?: boolean;
  /** 当月の月収内訳（基本給 + 手当 + 残業）。今期カードでのみ渡す。 */
  income?: MonthlyIncomeDTO | null;
}) {
  const navigate = useNavigate();
  const guidance = result ? guidanceForStatus(result.breakdown.status) : null;
  // その期の平均単価から、この期固有のティアを判定する（カードの枠線色に反映）。
  const tier: Tier | null = result
    ? findTier(result.breakdown.avgUnitPrice)
    : null;

  return (
    <Card
      className={`${tier ? "tier-border" : ""}${highlight ? " ring-accent/40 ring-2" : ""}`}
      data-tier={tier ?? undefined}
    >
      <Card.Header className="flex flex-row items-center justify-between">
        <Card.Title className="text-sm">{label}</Card.Title>
        {result && (
          <StatusBadge
            status={result.breakdown.status}
            bandCode={result.breakdown.band.code}
          />
        )}
      </Card.Header>

      <Card.Content>
        {!result ? (
          <p className="text-muted text-sm">{emptyText}</p>
        ) : (
          <div>
            {result.breakdown.salary === null ? (
              <p className="text-warning text-2xl font-bold">
                {guidance?.badge ?? "—"}
              </p>
            ) : (
              <p className="text-3xl font-bold">
                {formatYen(result.breakdown.salary)}
                <span className="text-muted ml-1 text-base font-normal">円</span>
              </p>
            )}
            <p className="text-muted mt-1 text-xs">
              {result.periodLabel} 適用
              {result.breakdown.salary !== null && (
                <> ・ 平均単価 {formatYen(result.breakdown.avgUnitPrice)} 円</>
              )}
            </p>
            {result.rankProvisional &&
              result.breakdown.band.kind === "rank" && (
                <p className="text-warning mt-1 text-xs font-medium">
                  暫定ランク1で計算中
                </p>
              )}

            {/* 当月の実支給見込み（基本給 + 手当 + 残業）。手当・残業がある月のみ表示。 */}
            {income &&
              result.breakdown.salary !== null &&
              (income.allowanceTotal > 0 || income.overtimePay > 0) && (
                <div className="border-border mt-3 border-t pt-3">
                  <p className="text-muted text-xs">実支給見込み（当月）</p>
                  <p className="text-2xl font-bold">
                    {formatYen(income.gross)}
                    <span className="text-muted ml-1 text-sm font-normal">
                      円
                    </span>
                  </p>
                  <p className="text-muted mt-1 text-xs">
                    基本給 {formatYen(income.baseSalary)}
                    {income.allowanceTotal > 0 && (
                      <> ＋ 手当 {formatYen(income.allowanceTotal)}</>
                    )}
                    {income.overtimePay > 0 && (
                      <> ＋ 残業 {formatYen(income.overtimePay)}</>
                    )}{" "}
                    円
                  </p>
                </div>
              )}
            {guidance && (
              <div className="mt-3">
                <StatusGuidance status={result.breakdown.status} compact />
              </div>
            )}
            <div className="mt-3">
              <Button variant="ghost" size="sm" onPress={() => navigate({ to: "/detail" })}>
                詳細を見る →
              </Button>
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
