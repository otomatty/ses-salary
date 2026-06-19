import { Alert, Button, Card } from "@heroui/react";
import type { DashboardResponse, MonthlyIncomeDTO } from "@shared/types";
import { formatYen } from "@shared/calc";
import { guidanceForStatus } from "@shared/guidance";
import type { SalaryResult } from "@shared/periods";
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

      {/* 推移グラフ（主役） */}
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

      {/* 各画面への入口 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NavTile
          title="月別入力"
          desc="各月の単価・残業・手当を入力"
          onClick={() => navigate({ to: "/prices" })}
        />
        <NavTile
          title="計算根拠の内訳"
          desc="帯・ランク・率・式を確認"
          onClick={() => navigate({ to: "/detail" })}
        />
        <NavTile
          title="単価シミュレーション"
          desc="仮単価で次の給与を試算"
          onClick={() => navigate({ to: "/simulate" })}
        />
        <NavTile
          title="設定"
          desc="評価ランクの選択"
          onClick={() => navigate({ to: "/settings" })}
        />
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

  return (
    <Card className={highlight ? "ring-accent/40 ring-2" : ""}>
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
                計算根拠を見る →
              </Button>
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

/** 各画面への遷移タイル（ボタン）。 */
function NavTile({
  title,
  desc,
  onClick,
}: {
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="border-border bg-surface hover:border-accent rounded-xl border p-4 text-left shadow-sm transition hover:shadow"
    >
      <p className="font-semibold">{title}</p>
      <p className="text-muted mt-1 text-xs">{desc}</p>
    </button>
  );
}
