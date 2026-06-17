import type { ReactNode } from "react";
import type { DashboardResponse, SalaryResultDTO } from "@shared/types";
import { formatYen, formatRate } from "@shared/calc";
import { CONSULT_GUIDANCE } from "@shared/guidance";
import { RATE_BANDS } from "@shared/rateTable";
import { Badge, Card, SectionTitle } from "../components/ui";
import { SalaryBreakdownCard } from "../components/SalaryBreakdownCard";
import { navigate } from "../router";

/** 計算根拠の内訳（PRD §8 画面4 / §6.3）。検算用。 */
export function Detail({ dashboard }: { dashboard: DashboardResponse }) {
  const hasAny = dashboard.current || dashboard.next;

  // 適用月 → 保存済み（確定）スナップショット
  const savedByMonth = new Map<string, SalaryResultDTO>(
    dashboard.savedResults.map((s) => [s.appliedFrom, s]),
  );

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
          <p className="mb-3 text-xs text-slate-400">
            <span className="font-medium text-emerald-700">確定</span>
            は保存済みスナップショット（当時の率・額をそのまま保持）、
            <span className="font-medium text-slate-500">再計算</span>
            は現行の早見表で再計算した値です。早見表改定後は両者が異なる場合があります。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3">適用期間</th>
                  <th className="py-2 pr-3">区分</th>
                  <th className="py-2 pr-3">平均単価</th>
                  <th className="py-2 pr-3">帯</th>
                  <th className="py-2 pr-3">ランク</th>
                  <th className="py-2 pr-3">還元率</th>
                  <th className="py-2 text-right">給与</th>
                </tr>
              </thead>
              <tbody>
                {[...dashboard.history].reverse().map((r) => {
                  const saved = savedByMonth.get(r.appliedFrom);
                  // 確定値があれば確定値を主表示し、再計算値と異なれば併記する。
                  const b = r.breakdown;
                  const band = saved ? saved.appliedBand : b.band.code;
                  const isSingleOrFixed =
                    b.status === "fixed" || b.band.kind === "single";
                  const savedBandKind = saved
                    ? RATE_BANDS.find((x) => x.code === saved.appliedBand)
                        ?.kind
                    : undefined;
                  const rankCell = saved
                    ? saved.appliedRate === null || savedBandKind === "single"
                      ? "—"
                      : saved.appliedRank
                    : isSingleOrFixed
                      ? "—"
                      : b.rank;
                  const rate = saved ? saved.appliedRate : b.rate;
                  const salary = saved ? saved.salary : b.salary;
                  const recalcDiffers =
                    saved != null &&
                    (saved.salary !== b.salary ||
                      saved.appliedRate !== b.rate ||
                      saved.appliedBand !== b.band.code);
                  return (
                    <tr
                      key={r.appliedFrom}
                      className="border-b border-slate-50 text-slate-700"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {r.periodLabel}
                      </td>
                      <td className="py-2 pr-3">
                        {saved ? (
                          <Badge tone="green">確定</Badge>
                        ) : (
                          <Badge tone="slate">再計算</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {formatYen(
                          saved ? saved.avgUnitPrice : b.avgUnitPrice,
                        )}
                      </td>
                      <td className="py-2 pr-3">{band}</td>
                      <td className="py-2 pr-3">{rankCell}</td>
                      <td className="py-2 pr-3">
                        {rate === null ? "—" : formatRate(rate)}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {salary === null
                          ? CONSULT_GUIDANCE.badge
                          : formatYen(salary)}
                        {recalcDiffers && (
                          <span className="block text-xs font-normal text-amber-600">
                            再計算:{" "}
                            {b.salary === null
                              ? CONSULT_GUIDANCE.badge
                              : formatYen(b.salary)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
                      {CONSULT_GUIDANCE.badge}
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
