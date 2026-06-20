import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/react";
import {
  monthHasPayableSalary,
  salaryCellLabelForDraft,
  salaryCellTooltipExtra,
  salaryForMonthQuarterWithDraft,
} from "@shared/quarterSalary";
import { currentYearMonth } from "@shared/periods";
import type { Rank } from "@shared/rateTable";
import { buildYearMonthCells } from "../lib/yearMonthStrip";
import {
  allowanceBadgeLabel,
  applyAllowanceTemplate,
  emptyMasterRows,
  masterRowsFromItems,
  masterRowsToItems,
  type AllowanceDraft,
  type AllowanceMasterRowDraft,
} from "../lib/allowanceStrip";
import { useMonthStripSelection } from "../lib/useMonthStripSelection";
import { AllowanceRowsEditor } from "./AllowanceRowsEditor";
import { YearMonthStrip } from "./YearMonthStrip";

/** 月ストリップ選択時の手当テンプレート編集。 */
export function AllowanceYearEditor({
  value,
  onChange,
  priceMap,
  rankDraft,
  consultRate = null,
  endMonth = currentYearMonth(),
}: {
  value: AllowanceDraft;
  onChange: (next: AllowanceDraft) => void;
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

  const [rows, setRows] = useState<AllowanceMasterRowDraft[]>(() =>
    emptyMasterRows(),
  );
  const prevSelectionKeyRef = useRef("");

  useEffect(() => {
    const key = [...selection].sort().join(",");
    if (key === prevSelectionKeyRef.current) return;
    prevSelectionKeyRef.current = key;
    if (selectedList.length === 1) {
      const items = value.get(selectedList[0]!) ?? [];
      setRows(masterRowsFromItems(items));
    } else if (selectedList.length === 0) {
      setRows(emptyMasterRows());
    }
  }, [selection, selectedList, value]);

  const configuredCount = useMemo(
    () =>
      [...value.entries()].filter(
        ([ym, items]) => isPayable(ym) && items.some((i) => i.amount > 0),
      ).length,
    [value, isPayable],
  );

  const applyToSelection = () => {
    if (!hasSelection) return;
    const items = masterRowsToItems(rows);
    onChange(applyAllowanceTemplate(value, selection, items));
  };

  const applyToAllPayable = () => {
    const items = masterRowsToItems(rows);
    if (items.length === 0) return;
    onChange(applyAllowanceTemplate(value, payableMonths, items));
  };

  return (
    <div className="space-y-3">
      <YearMonthStrip
        endMonth={endMonth}
        ariaLabel="直近12ヶ月の基本給（手当設定対象）"
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
              手当設定{" "}
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
          const items = value.get(cell.yearMonth) ?? [];
          const tooltipText = payable
            ? `${cell.year}年${cell.month}月・基本給 ${detail}・${salaryCellTooltipExtra(salaryResult)}`
            : `${cell.year}年${cell.month}月・支給額なし（直前四半期の単価不足など）`;

          return {
            variant: payable ? "set" : "unset",
            detail,
            badge: payable ? allowanceBadgeLabel(items) : null,
            tooltip: tooltipText,
          };
        }}
      />

      <div className="bg-surface-secondary space-y-3 rounded-lg p-3">
        <div className="text-muted text-xs">
          支給額が算出できる月をクリック／ドラッグで複数選択し、付与する手当にチェックを入れて金額を入力、「選択月に適用」で反映します。
        </div>
        <div className="text-muted text-xs">
          対象:{" "}
          <span className="text-foreground font-medium">{targetLabel}</span>
        </div>

        <div className="space-y-2">
          <p className="text-muted text-xs font-medium">手当</p>
          <AllowanceRowsEditor rows={rows} onChange={setRows} />
        </div>

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
