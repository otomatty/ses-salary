import { useEffect, useRef, useState } from "react";
import {
  formatSelectionQuartersLabel,
  quarterSelectionRange,
  selectedQuarterStarts,
} from "./quarterStrip";
import {
  formatYearMonthLabel,
  monthSelectionRange,
  monthSelectionRangeSameBand,
} from "./yearMonthStrip";

type RangeMode = "free" | "same-band" | "quarter";

/**
 * 12ヶ月ストリップの月選択（クリック／ドラッグ／Shift+クリック）を管理する。
 * - `quarter`: 四半期単位（1–3 / 4–6 / 7–9 / 10–12月）で選択
 * - `same-band`: 同一帯の月だけ範囲選択
 * - `free`: 月単位の自由な範囲選択
 */
export function useMonthStripSelection(options?: {
  rangeMode?: RangeMode;
  bandKey?: (ym: string) => string | null;
  /** false を返す月は選択できない（支給額なし月など）。 */
  isSelectable?: (ym: string) => boolean;
}) {
  const rangeMode = options?.rangeMode ?? "free";
  const bandKey = options?.bandKey;
  const isSelectable = options?.isSelectable;

  const canSelect = (ym: string) => !isSelectable || isSelectable(ym);

  const [selection, setSelection] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const stopDragging = () => {
      draggingRef.current = false;
    };
    document.addEventListener("pointerup", stopDragging);
    return () => document.removeEventListener("pointerup", stopDragging);
  }, []);

  const rangeFor = (anchor: string, other: string): Set<string> => {
    let range: Set<string>;
    switch (rangeMode) {
      case "quarter":
        range = quarterSelectionRange(anchor, other);
        break;
      case "same-band":
        range = bandKey
          ? monthSelectionRangeSameBand(anchor, other, bandKey)
          : monthSelectionRange(anchor, other);
        break;
      default:
        range = monthSelectionRange(anchor, other);
    }
    if (!isSelectable) return range;
    return new Set([...range].filter(canSelect));
  };

  const selectSingle = (ym: string) => {
    if (!canSelect(ym)) return new Set<string>();
    if (rangeMode === "quarter") {
      return quarterSelectionRange(ym, ym);
    }
    return new Set([ym]);
  };

  const handlePointerDown = (ym: string, shiftKey: boolean) => {
    if (!canSelect(ym)) return;
    if (shiftKey && anchorRef.current) {
      setSelection(rangeFor(anchorRef.current, ym));
      return;
    }
    draggingRef.current = true;
    anchorRef.current = ym;
    setSelection(selectSingle(ym));
  };

  const handlePointerEnter = (ym: string) => {
    if (!draggingRef.current || anchorRef.current == null) return;
    if (!canSelect(ym)) return;
    setSelection(rangeFor(anchorRef.current, ym));
  };

  const handleActivate = (ym: string) => {
    if (!canSelect(ym)) return;
    anchorRef.current = ym;
    setSelection(selectSingle(ym));
  };

  const selectedList = [...selection].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const selectedQuarters = selectedQuarterStarts(selection);
  const hasSelection = selectedList.length > 0;
  const targetLabel =
    rangeMode === "quarter"
      ? formatSelectionQuartersLabel(selectedQuarters)
      : !hasSelection
        ? "月を選択してください"
        : selectedList.length === 1
          ? formatYearMonthLabel(selectedList[0]!)
          : `${formatYearMonthLabel(selectedList[0]!)} 〜 ${formatYearMonthLabel(
              selectedList[selectedList.length - 1]!,
            )}（${selectedList.length}ヶ月）`;

  return {
    selection,
    setSelection,
    selectedList,
    selectedQuarters,
    hasSelection,
    targetLabel,
    handlePointerDown,
    handlePointerEnter,
    handleActivate,
  };
}
