import { useMemo, type ReactNode } from "react";
import { Tooltip } from "@heroui/react";
import { currentYearMonth } from "@shared/periods";
import {
  buildYearMonthCells,
  type YearMonthCell,
} from "../lib/yearMonthStrip";

export type YearMonthCellVariant = "set" | "unset";

export interface YearMonthCellRenderState {
  variant: YearMonthCellVariant;
  detail: string;
  tooltip: string;
  /** セル上部に表示するバッジ（例: G-2）。 */
  badge?: string | null;
}

/**
 * 直近12ヶ月を横並びで表示する汎用ストリップ。
 * セルの見た目・3行目の表示は {@link renderCell} で差し替える。
 */
export function YearMonthStrip({
  endMonth = currentYearMonth(),
  ariaLabel,
  legend,
  selectedMonths,
  renderCell,
  onCellPointerDown,
  onCellPointerEnter,
  onCellActivate,
}: {
  endMonth?: string;
  ariaLabel: string;
  legend?: ReactNode;
  selectedMonths?: ReadonlySet<string>;
  renderCell: (cell: YearMonthCell, index: number, cells: YearMonthCell[]) => YearMonthCellRenderState;
  onCellPointerDown?: (yearMonth: string, shiftKey: boolean) => void;
  onCellPointerEnter?: (yearMonth: string) => void;
  onCellActivate?: (yearMonth: string) => void;
}) {
  const cells = useMemo(() => buildYearMonthCells(endMonth), [endMonth]);
  const interactive = onCellPointerDown != null || onCellActivate != null;

  return (
    <div
      className={
        interactive ? "year-month-strip" : "year-month-strip year-month-strip--static"
      }
    >
      {legend}
      <div
        className="year-month-strip__row"
        role={interactive ? "listbox" : "list"}
        aria-multiselectable={interactive ? true : undefined}
        aria-label={ariaLabel}
      >
        {cells.map((cell, i) => {
          const { variant, detail, tooltip, badge } = renderCell(cell, i, cells);
          const isSelected = selectedMonths?.has(cell.yearMonth) ?? false;
          const showYear = i === 0 || cell.year !== cells[i - 1]!.year;

          return (
            <div key={cell.yearMonth} className="year-month-strip__cell-wrap">
              <div className="year-month-strip__cell-badge-slot" aria-hidden={!badge}>
                {badge ? (
                  <span className="year-month-strip__cell-badge">{badge}</span>
                ) : null}
              </div>
              <Tooltip delay={150} closeDelay={0}>
                <Tooltip.Trigger
                  className={[
                    "year-month-strip__cell",
                    variant === "set"
                      ? "year-month-strip__cell--set"
                      : "year-month-strip__cell--unset",
                    isSelected ? "year-month-strip__cell--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  role={interactive ? "option" : "listitem"}
                  aria-label={tooltip}
                  aria-selected={interactive ? isSelected : undefined}
                  onPointerDown={
                    interactive
                      ? (e) => {
                          e.preventDefault();
                          onCellPointerDown?.(cell.yearMonth, e.shiftKey);
                        }
                      : undefined
                  }
                  onPointerEnter={
                    interactive
                      ? () => onCellPointerEnter?.(cell.yearMonth)
                      : undefined
                  }
                  onKeyDown={
                    interactive
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onCellActivate?.(cell.yearMonth);
                          }
                        }
                      : undefined
                  }
                >
                  <span className="year-month-strip__cell-year">
                    {showYear ? cell.year : "\u00A0"}
                  </span>
                  <span className="year-month-strip__cell-month">{cell.month}月</span>
                  <span className="year-month-strip__cell-detail">{detail}</span>
                </Tooltip.Trigger>
                <Tooltip.Content showArrow>{tooltip}</Tooltip.Content>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
}
