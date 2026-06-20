import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Disclosure } from "@heroui/react";
import {
  monthHasPayableSalary,
  salaryCellLabelForDraft,
  salaryCellTooltipExtra,
  salaryForMonthQuarterWithDraft,
} from "@shared/quarterSalary";
import { currentYearMonth } from "@shared/periods";
import type { Rank } from "@shared/rateTable";
import type { OvertimeHours } from "@shared/income";
import { buildYearMonthCells } from "../lib/yearMonthStrip";
import {
  applyOvertimeTemplate,
  overtimeBadgeLabel,
  overtimeForMonth,
  type OvertimeDraft,
} from "../lib/overtimeStrip";
import { useMonthStripSelection } from "../lib/useMonthStripSelection";
import { HoursField } from "./HoursField";
import { YearMonthStrip } from "./YearMonthStrip";

/**
 * 支給額が算出できる月だけを選び、残業時間を一括設定するエディタ。
 */
export function OvertimeYearEditor({
  value,
  onChange,
  priceMap,
  rankDraft,
  consultRate = null,
  endMonth = currentYearMonth(),
}: {
  value: OvertimeDraft;
  onChange: (next: OvertimeDraft) => void;
  priceMap: Map<string, number>;
  rankDraft: Map<string, Rank>;
  consultRate?: number | null;
  endMonth?: string;
}) {
  const cells = useMemo(() => buildYearMonthCells(endMonth), [endMonth]);

  const isPayable = useCallback(
    (ym: string) =>
      monthHasPayableSalary(ym, priceMap, rankDraft, consultRate),
    [priceMap, rankDraft, consultRate],
  );

  const payableMonths = useMemo(
    () => cells.filter((c) => isPayable(c.yearMonth)).map((c) => c.yearMonth),
    [cells, isPayable],
  );

  const {
    selection,
    selectedList,
    hasSelection,
    targetLabel,
    handlePointerDown,
    handlePointerEnter,
    handleActivate,
  } = useMonthStripSelection({ rangeMode: "free", isSelectable: isPayable });

  const [normalHours, setNormalHours] = useState(0);
  const [nightHours, setNightHours] = useState(0);
  const [holidayHours, setHolidayHours] = useState(0);
  const prevSelectionKeyRef = useRef("");

  useEffect(() => {
    const key = [...selection].sort().join(",");
    if (key === prevSelectionKeyRef.current) return;
    prevSelectionKeyRef.current = key;
    if (selectedList.length === 1) {
      const ot = overtimeForMonth(value, selectedList[0]!);
      setNormalHours(ot.normalHours);
      setNightHours(ot.nightHours);
      setHolidayHours(ot.holidayHours);
    }
  }, [selection, selectedList, value]);

  const configuredCount = useMemo(
    () =>
      [...value.entries()].filter(
        ([ym, ot]) =>
          isPayable(ym) &&
          (ot.normalHours > 0 || ot.nightHours > 0 || ot.holidayHours > 0),
      ).length,
    [value, isPayable],
  );

  const currentHours = (): OvertimeHours => ({
    normalHours,
    nightHours,
    holidayHours,
  });

  const applyToSelection = () => {
    if (!hasSelection) return;
    onChange(applyOvertimeTemplate(value, selection, currentHours()));
  };

  const applyToAllPayable = () => {
    onChange(applyOvertimeTemplate(value, payableMonths, currentHours()));
  };

  const hasOptionalOt = nightHours > 0 || holidayHours > 0;

  return (
    <div className="space-y-3">
      <YearMonthStrip
        endMonth={endMonth}
        ariaLabel="直近12ヶ月の基本給（残業設定対象）"
        selectedMonths={selection}
        onCellPointerDown={handlePointerDown}
        onCellPointerEnter={handlePointerEnter}
        onCellActivate={handleActivate}
        legend={
          <div className="year-month-strip__legend text-muted text-xs">
            <span className="year-month-strip__legend-item">
              <span className="year-month-strip__swatch year-month-strip__swatch--set" />
              支給額あり
            </span>
            <span className="year-month-strip__legend-item">
              <span className="year-month-strip__swatch year-month-strip__swatch--unset" />
              支給額なし
            </span>
            <span className="ml-auto">
              残業入力{" "}
              <strong className="text-foreground">{configuredCount}</strong> 月
            </span>
          </div>
        }
        renderCell={(cell) => {
          const payable = isPayable(cell.yearMonth);
          const salaryResult = payable
            ? salaryForMonthQuarterWithDraft(
                cell.yearMonth,
                priceMap,
                rankDraft,
                consultRate,
              )
            : null;
          const detail = payable
            ? salaryCellLabelForDraft(
                cell.yearMonth,
                priceMap,
                rankDraft,
                consultRate,
              )
            : "—";
          const ot = overtimeForMonth(value, cell.yearMonth);
          const tooltipText = payable
            ? `${cell.year}年${cell.month}月・基本給 ${detail}・${salaryCellTooltipExtra(salaryResult)}`
            : `${cell.year}年${cell.month}月・支給額なし`;

          return {
            variant: payable ? "set" : "unset",
            detail,
            badge: payable ? overtimeBadgeLabel(ot) : null,
            tooltip: tooltipText,
          };
        }}
      />

      <div className="bg-surface-secondary space-y-3 rounded-lg p-3">
        <div className="text-muted text-xs">
          支給額が算出できる月を選び、残業時間を入力して「選択月に適用」します。
          みなし残業を超えた分のみ残業代に加算されます。
        </div>
        <div className="text-muted text-xs">
          対象:{" "}
          <span className="text-foreground font-medium">{targetLabel}</span>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <HoursField
            label="残業（通常）"
            value={normalHours}
            onChange={setNormalHours}
          />
        </div>

        <Disclosure defaultExpanded={hasOptionalOt}>
          <Disclosure.Heading>
            <Disclosure.Trigger>
              深夜・法定休日の残業（任意）
              <Disclosure.Indicator />
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="flex flex-wrap items-start gap-3 pt-3">
              <HoursField
                label="深夜労働"
                value={nightHours}
                onChange={setNightHours}
                description="22:00〜5:00。割増は加算分 +0.25。"
              />
              <HoursField
                label="法定休日労働"
                value={holidayHours}
                onChange={setHolidayHours}
                description="割増率 1.35。"
              />
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onPress={applyToAllPayable}
            isDisabled={payableMonths.length === 0}
          >
            支給額のある全月に適用
          </Button>
          <Button
            variant="primary"
            size="sm"
            onPress={applyToSelection}
            isDisabled={!hasSelection}
          >
            選択月に適用
          </Button>
        </div>
      </div>
    </div>
  );
}
