import {
  addMonths,
  compareYM,
  quarterMonths,
  quarterStartMonth,
} from "@shared/periods";

/** 選択月からユニークな適用四半期開始月（昇順）。 */
export function selectedQuarterStarts(selection: Iterable<string>): string[] {
  const quarters = new Set<string>();
  for (const ym of selection) quarters.add(quarterStartMonth(ym));
  return [...quarters].sort();
}

/**
 * 2つの月が属する四半期の間（両端含む）の、すべての月を返す。
 * クリック／ドラッグは月単位だが、選択単位は四半期。
 */
export function quarterSelectionRange(anchorYm: string, otherYm: string): Set<string> {
  const anchorQ = quarterStartMonth(anchorYm);
  const otherQ = quarterStartMonth(otherYm);
  const [startQ, endQ] =
    compareYM(anchorQ, otherQ) <= 0 ? [anchorQ, otherQ] : [otherQ, anchorQ];

  const months = new Set<string>();
  let cursor = startQ;
  while (compareYM(cursor, endQ) <= 0) {
    for (const m of quarterMonths(cursor)) months.add(m);
    cursor = addMonths(cursor, 3);
  }
  return months;
}

/** 四半期開始月の表示（例: 2026年1〜3月）。 */
export function formatQuarterLabelJa(quarterStart: string): string {
  const [year, startMonth] = quarterStart.split("-").map(Number);
  return `${year}年${startMonth}〜${startMonth + 2}月`;
}

/** 選択中四半期の表示ラベル。 */
export function formatSelectionQuartersLabel(quarterStarts: string[]): string {
  if (quarterStarts.length === 0) return "クォータを選択してください";
  if (quarterStarts.length === 1) {
    return formatQuarterLabelJa(quarterStarts[0]!);
  }
  return `${formatQuarterLabelJa(quarterStarts[0]!)} 〜 ${formatQuarterLabelJa(
    quarterStarts[quarterStarts.length - 1]!,
  )}（${quarterStarts.length}期）`;
}
