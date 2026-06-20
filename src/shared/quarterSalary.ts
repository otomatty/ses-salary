import { formatManYenFloorDisplay } from "./calc";
import {
  computeSalaryForQuarterWithRank,
  quarterStartMonth,
  type SalaryResult,
} from "./periods";
import type { Rank } from "./rateTable";

/**
 * 指定月が属する適用四半期の給与計算結果を返す（四半期ごとの明示ランク）。
 * {@link draft} にキーが無い四半期はランク 1 として試算する。
 */
export function salaryForMonthQuarterWithDraft(
  ym: string,
  priceMap: Map<string, number>,
  draft: Map<string, Rank>,
  consultRate?: number | null,
): SalaryResult | null {
  const qs = quarterStartMonth(ym);
  const rank = draft.get(qs) ?? 1;
  return computeSalaryForQuarterWithRank(qs, priceMap, rank, consultRate);
}

/** 四半期が給与試算可能か（直前四半期の単価が揃う等）。 */
export function isQuarterCalculable(
  quarterStart: string,
  priceMap: Map<string, number>,
): boolean {
  return (
    computeSalaryForQuarterWithRank(
      quarterStartMonth(quarterStart),
      priceMap,
      1,
    ) != null
  );
}

/** 指定月に支給額（基本給）が算出できるか。手当・残業の適用対象判定に使う。 */
export function monthHasPayableSalary(
  ym: string,
  priceMap: Map<string, number>,
  rankDraft: Map<string, Rank>,
  consultRate?: number | null,
): boolean {
  const result = salaryForMonthQuarterWithDraft(
    ym,
    priceMap,
    rankDraft,
    consultRate,
  );
  return result?.breakdown.salary != null;
}

/** 12ヶ月ストリップのセルに表示する基本給ラベル（万円端数切り捨て、算出不能なら —）。 */
export function formatSalaryCellLabelDisplay(result: SalaryResult | null): string {
  if (result == null) return "—";
  const salary = result.breakdown.salary;
  if (salary == null) return "—";
  return formatManYenFloorDisplay(salary);
}

/** セル表示用: 月 → 基本給（表示用・端数切り捨て）。 */
export function salaryCellLabelForDraft(
  ym: string,
  priceMap: Map<string, number>,
  draft: Map<string, Rank>,
  consultRate?: number | null,
): string {
  return formatSalaryCellLabelDisplay(
    salaryForMonthQuarterWithDraft(ym, priceMap, draft, consultRate),
  );
}

/** セル tooltip 用の計算式テキスト。 */
export function salaryCellTooltipExtra(result: SalaryResult | null): string {
  if (result == null) return "算出不能（直前四半期の単価不足）";
  const b = result.breakdown;
  if (b.salary == null) return b.note ?? "要相談";
  return b.formula;
}
