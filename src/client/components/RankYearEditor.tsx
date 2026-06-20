import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { bandAtMonth } from "@shared/bandAtMonth";
import {
  salaryCellLabelForDraft,
  salaryCellTooltipExtra,
  salaryForMonthQuarterWithDraft,
} from "@shared/quarterSalary";
import { currentYearMonth, quarterStartMonth } from "@shared/periods";
import type { Rank } from "@shared/rateTable";
import { formatQuarterLabelJa } from "../lib/quarterStrip";
import {
  applyRankDraft,
  clearRankDraft,
  DEFAULT_PICKER_RANK,
  pickerRankForSelection,
  rankBadgeForCell,
  rankBadgeLabel,
  rankForQuarter,
  selectionKey,
} from "../lib/rankStrip";
import { useMonthStripSelection } from "../lib/useMonthStripSelection";
import { RankSelector } from "./RankSelector";
import { YearMonthStrip } from "./YearMonthStrip";

/**
 * 直近12ヶ月ストリップで四半期（クォータ）を選び、評価ランクを設定するエディタ。
 * 各セルにはその四半期の基本給（直前四半期平均 × 還元率）を表示する。
 */
export function RankYearEditor({
  value,
  onChange,
  priceMap,
  consultRate = null,
  endMonth = currentYearMonth(),
}: {
  /** 下書きのランク履歴（四半期開始月 → rank）。未設定四半期は表示上ランク 1。 */
  value: Map<string, Rank>;
  onChange: (next: Map<string, Rank>) => void;
  priceMap: Map<string, number>;
  consultRate?: number | null;
  endMonth?: string;
}) {
  const {
    selection,
    selectedQuarters,
    hasSelection,
    targetLabel,
    handlePointerDown,
    handlePointerEnter,
    handleActivate,
  } = useMonthStripSelection({ rangeMode: "quarter" });

  const anchorQuarter = selectedQuarters[0] ?? null;
  const selectionBand = anchorQuarter
    ? bandAtMonth(anchorQuarter, priceMap)
    : null;

  const [pickerRank, setPickerRank] = useState<Rank>(() =>
    pickerRankForSelection(selectedQuarters, value),
  );
  const prevSelectionKeyRef = useRef(selectionKey(selection));

  useEffect(() => {
    const key = selectionKey(selection);
    if (key === prevSelectionKeyRef.current) return;
    prevSelectionKeyRef.current = key;
    setPickerRank(pickerRankForSelection(selectedQuarters, value));
  }, [selection, selectedQuarters, value]);

  const configuredCount = value.size;

  const handleRankPick = (rank: Rank) => {
    setPickerRank(rank);
    if (!hasSelection) return;
    onChange(applyRankDraft(value, selection, rank));
  };

  const clear = () => {
    if (!hasSelection) return;
    onChange(clearRankDraft(value, selection));
    setPickerRank(DEFAULT_PICKER_RANK);
  };

  return (
    <div className="space-y-3">
      <YearMonthStrip
        endMonth={endMonth}
        ariaLabel="直近12ヶ月の基本給（四半期）"
        selectedMonths={selection}
        onCellPointerDown={handlePointerDown}
        onCellPointerEnter={handlePointerEnter}
        onCellActivate={handleActivate}
        legend={
          <div className="year-month-strip__legend text-muted text-xs">
            <span className="year-month-strip__legend-item">
              <span className="year-month-strip__swatch year-month-strip__swatch--set" />
              算出可
            </span>
            <span className="year-month-strip__legend-item">
              <span className="year-month-strip__swatch year-month-strip__swatch--unset" />
              算出不可
            </span>
            <span className="ml-auto">
              ランク設定{" "}
              <strong className="text-foreground">{configuredCount}</strong> 期
            </span>
          </div>
        }
        renderCell={(cell) => {
          const appliedQuarter = quarterStartMonth(cell.yearMonth);
          const salaryResult = salaryForMonthQuarterWithDraft(
            cell.yearMonth,
            priceMap,
            value,
            consultRate,
          );
          const detail = salaryCellLabelForDraft(
            cell.yearMonth,
            priceMap,
            value,
            consultRate,
          );
          const hasSalary = detail !== "—";
          const band = bandAtMonth(cell.yearMonth, priceMap);
          const bandLabel = band?.code ?? "帯不明";
          const rank = rankForQuarter(appliedQuarter, value);
          const rankLabel = rankBadgeLabel(cell.yearMonth, rank, priceMap);
          const tooltipText = `${cell.year}年${cell.month}月（${formatQuarterLabelJa(
            appliedQuarter,
          )}）・ 基本給 ${detail} ・ ${rankLabel}（${bandLabel}帯）・ ${salaryCellTooltipExtra(salaryResult)}`;

          return {
            variant: hasSalary ? "set" : "unset",
            detail,
            badge: rankBadgeForCell(cell.yearMonth, value, priceMap),
            tooltip: tooltipText,
          };
        }}
      />

      <div className="bg-surface-secondary space-y-3 rounded-lg p-3">
        <div className="text-muted text-xs">
          四半期（1–3 / 4–6 / 7–9 / 10–12月）をクリックして選択し、ランクを選ぶと
          即反映されます。ドラッグ／Shift+クリックで複数四半期を選べます。
        </div>
        <div className="text-muted text-xs">
          対象:{" "}
          <span className="text-foreground font-medium">{targetLabel}</span>
          {selectionBand && (
            <span className="ml-2">（{selectionBand.code} 帯）</span>
          )}
        </div>
        <RankSelector
          value={pickerRank}
          onChange={handleRankPick}
          band={selectionBand}
          showLabel={false}
        />
        <div className="flex justify-end">
          <Button variant="ghost" onPress={clear} isDisabled={!hasSelection}>
            クリア
          </Button>
        </div>
      </div>
    </div>
  );
}
