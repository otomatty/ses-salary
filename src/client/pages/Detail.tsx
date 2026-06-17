import type { ReactNode } from "react";
import type { DashboardResponse } from "@shared/types";
import { formatYen, formatRate } from "@shared/calc";
import { RATE_BANDS } from "@shared/rateTable";
import { Card, SectionTitle } from "../components/ui";
import { SalaryBreakdownCard } from "../components/SalaryBreakdownCard";
import { navigate } from "../router";

/** 計算根拠の内訳（PRD §8 画面4 / §6.3）。検算用。 */
export function Detail({ dashboard }: { dashboard: DashboardResponse }) {
  const hasAny = dashboard.current || dashboard.next;

  return (
    <div className="space-y-6">
      {!hasAny ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-400">
            計算根拠を表示するには、直近3ヶ月の月単価が必要です。
            <br />
            <button
              onClick={() => navigate("prices")}
              className="mt-2 text-indigo-600 hover:underline"
            >
              月単価を入力する →
            </button>
          </p>
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

      {/* 過去の計算結果一覧 */}
      {dashboard.history.length > 0 && (
        <Card>
          <SectionTitle>計算結果の履歴</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3">適用期間</th>
                  <th className="py-2 pr-3">平均単価</th>
                  <th className="py-2 pr-3">帯</th>
                  <th className="py-2 pr-3">ランク</th>
                  <th className="py-2 pr-3">還元率</th>
                  <th className="py-2 text-right">給与</th>
                </tr>
              </thead>
              <tbody>
                {[...dashboard.history].reverse().map((r) => (
                  <tr
                    key={r.appliedFrom}
                    className="border-b border-slate-50 text-slate-700"
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {r.periodLabel}
                    </td>
                    <td className="py-2 pr-3">
                      {formatYen(r.breakdown.avgUnitPrice)}
                    </td>
                    <td className="py-2 pr-3">{r.breakdown.band.code}</td>
                    <td className="py-2 pr-3">
                      {r.breakdown.status === "fixed" ||
                      r.breakdown.band.kind === "single"
                        ? "—"
                        : r.breakdown.rank}
                    </td>
                    <td className="py-2 pr-3">
                      {r.breakdown.rate === null
                        ? "—"
                        : formatRate(r.breakdown.rate)}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {r.breakdown.salary === null
                        ? "要相談"
                        : formatYen(r.breakdown.salary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 早見表マスタ */}
      <Card>
        <SectionTitle>早見表マスタ（還元率テーブル）</SectionTitle>
        <p className="mb-3 text-xs text-slate-400">
          会社共通の固定マスタです。平均単価の帯と評価ランクから還元率が決まります。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3">帯</th>
                <th className="py-2 pr-3">平均単価（円）</th>
                <th className="py-2 pr-3 text-right">ランク1</th>
                <th className="py-2 pr-3 text-right">ランク2</th>
                <th className="py-2 text-right">ランク3</th>
              </tr>
            </thead>
            <tbody>
              {RATE_BANDS.map((b) => {
                const range =
                  b.max === null
                    ? `${formatYen(b.min)} 〜`
                    : b.min === 0
                      ? `〜 ${formatYen(b.max)}`
                      : `${formatYen(b.min)} 〜 ${formatYen(b.max)}`;
                let cells: ReactNode;
                if (b.kind === "consult") {
                  cells = (
                    <td colSpan={3} className="py-2 text-right text-amber-600">
                      要相談
                    </td>
                  );
                } else if (b.kind === "fixed") {
                  cells = (
                    <td colSpan={3} className="py-2 text-right text-indigo-600">
                      一律 {formatYen(b.fixedAmount ?? 0)} 円
                    </td>
                  );
                } else if (b.kind === "single") {
                  cells = (
                    <td colSpan={3} className="py-2 text-right">
                      {formatRate(b.rate ?? 0)}（単一）
                    </td>
                  );
                } else {
                  cells = (
                    <>
                      <td className="py-2 pr-3 text-right">
                        {formatRate(b.rates![1])}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {formatRate(b.rates![2])}
                      </td>
                      <td className="py-2 text-right">
                        {formatRate(b.rates![3])}
                      </td>
                    </>
                  );
                }
                return (
                  <tr
                    key={b.code}
                    className="border-b border-slate-50 text-slate-700"
                  >
                    <td className="py-2 pr-3 font-medium">{b.code}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-500">
                      {range}
                    </td>
                    {cells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
