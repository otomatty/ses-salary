import { averageUnitPrice } from "./calc";
import {
  prevQuarterStart,
  quarterMonths,
  quarterStartMonth,
} from "./periods";
import { findBand, type RateBand } from "./rateTable";

/**
 * 指定月を含む四半期の給与計算で使われる帯を、直前四半期の3ヶ月単価から判定する。
 * 単価が揃わない月は null（帯不明）。
 */
export function bandAtMonth(
  ym: string,
  priceMap: Map<string, number>,
): RateBand | null {
  const targetStart = quarterStartMonth(ym);
  const sourceMonths = quarterMonths(prevQuarterStart(targetStart));
  const prices: number[] = [];
  for (const m of sourceMonths) {
    const price = priceMap.get(m);
    if (price === undefined) return null;
    prices.push(price);
  }
  return findBand(averageUnitPrice(prices));
}

/** 帯コード。帯不明は null。 */
export function bandKeyAtMonth(
  ym: string,
  priceMap: Map<string, number>,
): string | null {
  return bandAtMonth(ym, priceMap)?.code ?? null;
}
