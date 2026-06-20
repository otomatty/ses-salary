import { addMonths, compareYM, monthRange } from "@shared/periods";

/** 直近12ヶ月ストリップの1セル分。 */
export interface YearMonthCell {
  yearMonth: string;
  year: number;
  month: number;
}

/** endMonth を含む直近12ヶ月を古い順で返す。 */
export function buildYearMonthCells(endMonth: string): YearMonthCell[] {
  const cells: YearMonthCell[] = [];
  for (let i = 11; i >= 0; i--) {
    const ym = addMonths(endMonth, -i);
    const [year, month] = ym.split("-").map(Number);
    cells.push({ yearMonth: ym, year, month });
  }
  return cells;
}

/** 2つの年月（順不同）から、両端を含む連続範囲の集合を作る。 */
export function monthSelectionRange(a: string, b: string): Set<string> {
  const [start, end] = compareYM(a, b) <= 0 ? [a, b] : [b, a];
  return new Set(monthRange(start, end));
}

/**
 * 連続範囲のうち、起点と同じ帯キーに属する月だけを返す。
 * 帯が異なる月は範囲選択から除外する（ランク帯の切り替わりで枝番がリセットされるため）。
 */
export function monthSelectionRangeSameBand(
  anchor: string,
  other: string,
  bandKey: (ym: string) => string | null,
): Set<string> {
  const anchorBand = bandKey(anchor);
  const range = monthSelectionRange(anchor, other);
  return new Set([...range].filter((ym) => bandKey(ym) === anchorBand));
}

/** "YYYY-MM" → "YYYY年M月" */
export function formatYearMonthLabel(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return `${year}年${month}月`;
}
