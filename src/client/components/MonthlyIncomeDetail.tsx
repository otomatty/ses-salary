import { useMemo, useState, type ReactNode } from "react";
import { Card, Chip } from "@heroui/react";
import type { DashboardResponse } from "@shared/types";
import { formatYen } from "@shared/calc";
import {
  computeSalaryForQuarter,
  currentYearMonth,
  quarterStartMonth,
  type RankHistoryEntry,
} from "@shared/periods";
import {
  buildMonthlyIncome,
  type MonthlyAllowanceItem,
  type OvertimeHours,
} from "@shared/income";
import { YearMonthField } from "./YearMonthField";

/**
 * 月次の実支給（額面）詳細。月を選んで、その月の
 * 基本給 ＋ 手当 ＋ 残業代 ＝ 額面 と、残業・手当の内訳を表示する。
 *
 * 基本給はその月が属する四半期の確定給与（[Prices] と同じ算出経路）。
 * すべて dashboard の既存データからクライアント側で再計算する（API改修不要）。
 */
export function MonthlyIncomeDetail({
  dashboard,
}: {
  dashboard: DashboardResponse;
}) {
  // 基本給算出の前提（月別入力ページと同じ）。
  const priceMap = useMemo(
    () => new Map(dashboard.prices.map((p) => [p.yearMonth, p.unitPrice])),
    [dashboard.prices],
  );
  const rankHistory = useMemo<RankHistoryEntry[]>(
    () =>
      dashboard.rankHistory.map((r) => ({
        effectiveFrom: r.effectiveFrom,
        rank: r.rank,
      })),
    [dashboard.rankHistory],
  );

  // 既定は当月。当月の月収内訳があればその年月、無ければ現在年月。
  const [yearMonth, setYearMonth] = useState(
    () => dashboard.currentMonthIncome?.yearMonth ?? currentYearMonth(),
  );

  // 選択月の基本給（属する四半期の確定給与）。
  const baseSalary = useMemo(() => {
    const result = computeSalaryForQuarter(
      quarterStartMonth(yearMonth),
      priceMap,
      rankHistory,
    );
    return result?.breakdown.salary ?? null;
  }, [yearMonth, priceMap, rankHistory]);

  // 選択月の手当・残業を dashboard から抽出。
  const allowances = useMemo<MonthlyAllowanceItem[]>(
    () =>
      dashboard.allowances
        .filter((a) => a.yearMonth === yearMonth)
        .map((a) => ({
          name: a.name,
          amount: a.amount,
          includeInOvertimeBase: a.includeInOvertimeBase,
        })),
    [dashboard.allowances, yearMonth],
  );
  const overtime = useMemo<OvertimeHours | null>(() => {
    const o = dashboard.overtime.find((x) => x.yearMonth === yearMonth);
    return o
      ? {
          normalHours: o.normalHours,
          nightHours: o.nightHours,
          holidayHours: o.holidayHours,
        }
      : null;
  }, [dashboard.overtime, yearMonth]);

  const income = useMemo(
    () =>
      buildMonthlyIncome({
        yearMonth,
        baseSalary,
        settings: dashboard.settings,
        allowances,
        overtime,
      }),
    [yearMonth, baseSalary, dashboard.settings, allowances, overtime],
  );

  return (
    <Card>
      <Card.Header className="flex flex-row items-start justify-between gap-4">
        <div>
          <Card.Title className="text-sm">月次の実支給（額面）</Card.Title>
          <Card.Description className="text-xs">
            基本給 ＋ 手当 ＋ 残業代 の月別内訳。月を切り替えて確認できます。
          </Card.Description>
        </div>
        <YearMonthField
          label="対象月"
          value={yearMonth}
          onChange={setYearMonth}
        />
      </Card.Header>

      <Card.Content>
        {income === null ? (
          <p className="bg-surface-secondary text-muted rounded-lg px-3 py-4 text-sm">
            {yearMonth} が属する四半期の基本給がまだ算出できません（前四半期3ヶ月の月単価が必要、または要相談帯です）。月単価を入力すると表示されます。
          </p>
        ) : (
          <>
            {/* 額面（主役） */}
            <div className="mb-5">
              <p className="text-3xl font-bold">
                {formatYen(income.gross)}
                <span className="text-muted ml-1 text-base font-normal">円</span>
              </p>
              <p className="text-muted text-xs">額面実支給見込み（{yearMonth}）</p>
            </div>

            {/* 構成（基本給 + 固定残業代 + 手当 + 超過残業 = 額面） */}
            <p className="text-muted bg-surface-secondary mb-5 rounded-lg px-3 py-2 text-xs">
              基本給 {formatYen(income.baseSalary - income.overtime.deemedPay)}
              {" ＋ 固定残業代 "}
              {formatYen(income.overtime.deemedPay)}
              {income.allowanceTotal > 0 && (
                <> ＋ 手当 {formatYen(income.allowanceTotal)}</>
              )}
              {income.overtimePay > 0 && (
                <> ＋ 超過残業 {formatYen(income.overtimePay)}</>
              )}
              {" ＝ "}
              {formatYen(income.gross)} 円
            </p>

            {/* 残業代の内訳 */}
            <section className="mb-5">
              <p className="text-muted mb-2 text-xs font-medium">残業代の内訳</p>
              <dl className="space-y-2 text-sm">
                <Row label="時給基礎">
                  {formatYen(Math.round(income.overtime.hourlyBase))} 円/時
                </Row>
                <Row label="みなし残業（固定残業代）">
                  {income.overtime.deemedHours} 時間 ・{" "}
                  {formatYen(income.overtime.deemedPay)} 円
                </Row>
                {income.overtime.normalHours125 > 0 && (
                  <Row label="時間外 1.25倍">
                    {income.overtime.normalHours125} 時間
                  </Row>
                )}
                {income.overtime.normalHours150 > 0 && (
                  <Row label="時間外 1.5倍（月60h超）">
                    {income.overtime.normalHours150} 時間
                  </Row>
                )}
                {income.overtime.nightHours > 0 && (
                  <Row label="深夜（+0.25）">
                    {income.overtime.nightHours} 時間
                  </Row>
                )}
                {income.overtime.holidayHours > 0 && (
                  <Row label="法定休日（1.35倍）">
                    {income.overtime.holidayHours} 時間
                  </Row>
                )}
                <Row label="超過残業代">
                  {formatYen(income.overtimePay)} 円
                </Row>
              </dl>
            </section>

            {/* 手当の明細 */}
            {income.allowances.length > 0 && (
              <section>
                <p className="text-muted mb-2 text-xs font-medium">手当の明細</p>
                <dl className="space-y-2 text-sm">
                  {income.allowances.map((a) => (
                    <Row
                      key={a.name}
                      label={
                        <span className="flex items-center gap-1.5">
                          {a.name}
                          {a.includeInOvertimeBase && (
                            <Chip size="sm" variant="soft">
                              残業基礎
                            </Chip>
                          )}
                        </span>
                      }
                    >
                      {formatYen(a.amount)} 円
                    </Row>
                  ))}
                </dl>
              </section>
            )}
          </>
        )}
      </Card.Content>
    </Card>
  );
}

/** 内訳の1行（ラベルと値）。 */
function Row({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-border flex items-start justify-between gap-4 border-b pb-2">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
