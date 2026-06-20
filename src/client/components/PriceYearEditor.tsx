import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { manYenToYen, yenToManYen } from "@shared/calc";
import { currentYearMonth } from "@shared/periods";
import { useMonthStripSelection } from "../lib/useMonthStripSelection";
import { ManYenField } from "./ManYenField";
import { PriceYearStrip } from "./PriceYearStrip";

/**
 * 直近12ヶ月の月単価を「下書き」で編集するエディタ。
 *
 * - セルをクリックすると単月を選択（＝年月指定）。
 * - ドラッグ／Shift+クリックで連続範囲を選択し、同じ単価をまとめて適用（＝一括入力）。
 * - 入力値は親の {@link value}（下書き）にのみ反映し、保存はしない。
 *   実際の保存は親側の「次へ」などのボタンでまとめて行う。
 */
export function PriceYearEditor({
  value,
  onChange,
  endMonth = currentYearMonth(),
}: {
  /** 下書きの単価マップ（"YYYY-MM" → 円）。 */
  value: Map<string, number>;
  onChange: (next: Map<string, number>) => void;
  endMonth?: string;
}) {
  const {
    selection,
    hasSelection,
    targetLabel,
    handlePointerDown,
    handlePointerEnter,
    handleActivate,
  } = useMonthStripSelection();

  const [priceMan, setPriceMan] = useState<number | null>(null);

  useEffect(() => {
    const prices = [...selection].map((ym) => value.get(ym));
    const first = prices[0];
    const allSame = prices.length > 0 && prices.every((p) => p === first);
    setPriceMan(allSame && first != null ? yenToManYen(first) : null);
  }, [selection, value]);

  const priceValid =
    priceMan != null && Number.isFinite(priceMan) && priceMan > 0;

  const apply = () => {
    if (!hasSelection || !priceValid) return;
    const yen = manYenToYen(priceMan as number);
    const next = new Map(value);
    for (const ym of selection) next.set(ym, yen);
    onChange(next);
  };

  const clear = () => {
    if (!hasSelection) return;
    const next = new Map(value);
    for (const ym of selection) next.delete(ym);
    onChange(next);
    setPriceMan(null);
  };

  return (
    <div className="space-y-3">
      <PriceYearStrip
        priceMap={value}
        endMonth={endMonth}
        selectedMonths={selection}
        onCellPointerDown={handlePointerDown}
        onCellPointerEnter={handlePointerEnter}
        onCellActivate={handleActivate}
      />

      <div className="bg-surface-secondary rounded-lg p-3">
        <div className="text-muted mb-2 text-xs">
          月をクリック（ドラッグ／Shift+クリックで範囲選択）して単価を入力 → 適用
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-32">
            <span className="text-muted text-xs">対象</span>
            <p className="text-foreground text-sm font-medium">{targetLabel}</p>
          </div>
          <ManYenField
            label="単価（万円）"
            value={priceMan}
            onChange={setPriceMan}
          />
          <div className="ml-auto flex items-end gap-3">
            <Button
              variant="primary"
              onPress={apply}
              isDisabled={!hasSelection || !priceValid}
            >
              適用
            </Button>
            <Button variant="ghost" onPress={clear} isDisabled={!hasSelection}>
              クリア
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
