import { formatManYen } from "@shared/calc";
import { currentYearMonth } from "@shared/periods";
import { YearMonthStrip } from "./YearMonthStrip";

/**
 * 直近1年（12ヶ月）の月単価を横並びで俯瞰するストリップ。
 * 単価が設定済みの月は色付きで強調し、ホバー/フォーカスで単価をツールチップ表示する。
 *
 * ハンドラを渡すとセルが操作可能になり、クリック（単月選択）／ドラッグ・Shift+クリック
 * （連続範囲選択）で月を選べる。選択中の月は {@link selectedMonths} で強調する。
 */
export function PriceYearStrip({
  priceMap,
  endMonth = currentYearMonth(),
  selectedMonths,
  onCellPointerDown,
  onCellPointerEnter,
  onCellActivate,
}: {
  priceMap: Map<string, number>;
  endMonth?: string;
  selectedMonths?: ReadonlySet<string>;
  onCellPointerDown?: (yearMonth: string, shiftKey: boolean) => void;
  onCellPointerEnter?: (yearMonth: string) => void;
  onCellActivate?: (yearMonth: string) => void;
}) {
  const setCount = priceMap.size;

  return (
    <YearMonthStrip
      endMonth={endMonth}
      ariaLabel="直近12ヶ月の月単価"
      selectedMonths={selectedMonths}
      onCellPointerDown={onCellPointerDown}
      onCellPointerEnter={onCellPointerEnter}
      onCellActivate={onCellActivate}
      legend={
        <div className="year-month-strip__legend text-muted text-xs">
          <span className="year-month-strip__legend-item">
            <span className="year-month-strip__swatch year-month-strip__swatch--set" />
            単価あり
          </span>
          <span className="year-month-strip__legend-item">
            <span className="year-month-strip__swatch year-month-strip__swatch--unset" />
            未設定
          </span>
          <span className="ml-auto">
            直近12ヶ月中{" "}
            <strong className="text-foreground">{setCount}</strong> ヶ月入力済み
          </span>
        </div>
      }
      renderCell={(cell) => {
        const unitPrice = priceMap.get(cell.yearMonth);
        const isSet = unitPrice != null;
        const priceLabel = isSet ? formatManYen(unitPrice) : "未設定";
        const tooltipText = `${cell.year}年${cell.month}月 ・ ${
          isSet ? priceLabel : "未設定（クリックして入力）"
        }`;
        return {
          variant: isSet ? "set" : "unset",
          detail: isSet ? priceLabel : "—",
          tooltip: tooltipText,
        };
      }}
    />
  );
}
