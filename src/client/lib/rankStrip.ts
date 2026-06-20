import { bandAtMonth } from "@shared/bandAtMonth";
import { isQuarterCalculable } from "@shared/quarterSalary";
import { currentYearMonth, quarterStartMonth } from "@shared/periods";
import type { Rank } from "@shared/rateTable";
import { selectedQuarterStarts } from "./quarterStrip";
import { buildYearMonthCells } from "./yearMonthStrip";

/** ランク選択 UI の初期値（未設定四半期）。 */
export const DEFAULT_PICKER_RANK: Rank = 1;

/** 選択集合の比較用キー（順不同）。 */
export function selectionKey(selection: Iterable<string>): string {
  return [...selection].sort().join(",");
}

/** 四半期の試算ランク（未設定は 1）。 */
export function rankForQuarter(
  quarterStart: string,
  draft: Map<string, Rank>,
): Rank {
  return draft.get(quarterStartMonth(quarterStart)) ?? DEFAULT_PICKER_RANK;
}

/** セル上バッジのラベル（例: G-2）。 */
export function rankBadgeLabel(
  ym: string,
  rank: Rank,
  priceMap: Map<string, number>,
): string {
  const band = bandAtMonth(ym, priceMap);
  if (band?.kind === "rank") return `${band.code}-${rank}`;
  return `R${rank}`;
}

/**
 * セル上バッジ。算出可能な四半期は draft のランク（未設定は 1）を常時表示する。
 */
export function rankBadgeForCell(
  ym: string,
  draft: Map<string, Rank>,
  priceMap: Map<string, number>,
): string | null {
  const qs = quarterStartMonth(ym);
  if (!isQuarterCalculable(qs, priceMap)) return null;
  return rankBadgeLabel(ym, rankForQuarter(qs, draft), priceMap);
}

/** 選択四半期へランクを即時反映した下書きを返す（キーは四半期開始月）。 */
export function applyRankDraft(
  draft: Map<string, Rank>,
  selection: Iterable<string>,
  rank: Rank,
): Map<string, Rank> {
  const next = new Map(draft);
  for (const qs of selectedQuarterStarts(selection)) {
    next.set(qs, rank);
  }
  return next;
}

/** 選択四半期の明示設定を下書きから削除する（表示はランク 1 に戻る）。 */
export function clearRankDraft(
  draft: Map<string, Rank>,
  selection: Iterable<string>,
): Map<string, Rank> {
  const next = new Map(draft);
  for (const qs of selectedQuarterStarts(selection)) {
    next.delete(qs);
  }
  return next;
}

/** サーバ履歴を四半期開始月キーの下書きに正規化する。 */
export function normalizeRankDraft(
  entries: Iterable<{ effectiveFrom: string; rank: Rank }>,
): Map<string, Rank> {
  const sorted = [...entries].sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0,
  );
  const byQuarter = new Map<string, { effectiveFrom: string; rank: Rank }>();
  for (const entry of sorted) {
    const quarter = quarterStartMonth(entry.effectiveFrom);
    const isQuarterStart = entry.effectiveFrom === quarter;
    const prev = byQuarter.get(quarter);
    if (!prev) {
      byQuarter.set(quarter, entry);
      continue;
    }
    if (isQuarterStart) {
      byQuarter.set(quarter, entry);
      continue;
    }
    if (prev.effectiveFrom !== quarter) {
      byQuarter.set(quarter, entry);
    }
  }
  const draft = new Map<string, Rank>();
  for (const [quarter, { rank }] of byQuarter) {
    draft.set(quarter, rank);
  }
  return draft;
}

/** ストリップ表示範囲内で給与試算可能な四半期開始月（昇順・重複なし）。 */
export function calculableQuarterStartsInStrip(
  priceMap: Map<string, number>,
  endMonth: string = currentYearMonth(),
): string[] {
  const quarters = new Set<string>();
  for (const cell of buildYearMonthCells(endMonth)) {
    const qs = quarterStartMonth(cell.yearMonth);
    if (isQuarterCalculable(qs, priceMap)) {
      quarters.add(qs);
    }
  }
  return [...quarters].sort();
}

/**
 * UI 上ランク 1（下書き未設定）の四半期について、直前の明示ランクが 1 以外なら
 * rank 1 の境界 upsert を生成する（rankAt の持ち越しと表示の不一致を防ぐ）。
 */
export function defaultRankBoundaryUpserts(
  rankDraft: Map<string, Rank>,
  serverDraft: Map<string, Rank>,
  visibleQuarterStarts: string[],
  pendingUpserts: { effectiveFrom: string; rank: Rank }[],
): { effectiveFrom: string; rank: Rank }[] {
  const upsertKeys = new Set(pendingUpserts.map((u) => u.effectiveFrom));
  const boundaries: { effectiveFrom: string; rank: Rank }[] = [];
  const effectiveDraft = new Map(rankDraft);

  for (const qs of visibleQuarterStarts) {
    if (effectiveDraft.has(qs)) continue;
    if (serverDraft.has(qs)) continue;
    if (upsertKeys.has(qs)) continue;

    const sortedEntries = [...effectiveDraft.entries()].sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    let priorRank: Rank | undefined;
    for (const [q, rank] of sortedEntries) {
      if (q < qs) priorRank = rank;
      else break;
    }
    if (priorRank !== undefined && priorRank !== DEFAULT_PICKER_RANK) {
      boundaries.push({ effectiveFrom: qs, rank: DEFAULT_PICKER_RANK });
      effectiveDraft.set(qs, DEFAULT_PICKER_RANK);
      upsertKeys.add(qs);
    }
  }
  return boundaries;
}

/** 四半期開始月以外の旧ランク行を削除する前に必要な移行 upsert を返す。 */
export function legacyRankMigrationUpserts(
  rankHistory: { effectiveFrom: string; rank: Rank }[],
  serverDraft: Map<string, Rank>,
  rankDraft: Map<string, Rank>,
  pendingUpserts: { effectiveFrom: string; rank: Rank }[],
): { effectiveFrom: string; rank: Rank }[] {
  const migrations: { effectiveFrom: string; rank: Rank }[] = [];
  const upsertKeys = new Set(pendingUpserts.map((u) => u.effectiveFrom));
  for (const h of rankHistory) {
    const quarter = quarterStartMonth(h.effectiveFrom);
    if (h.effectiveFrom === quarter) continue;
    const hasQuarterStartRow = rankHistory.some(
      (x) => x.effectiveFrom === quarter,
    );
    if (hasQuarterStartRow || upsertKeys.has(quarter)) continue;
    migrations.push({
      effectiveFrom: quarter,
      rank: rankDraft.get(quarter) ?? serverDraft.get(quarter) ?? h.rank,
    });
    upsertKeys.add(quarter);
  }
  return migrations;
}

/** 選択四半期の先頭に設定されているランク（未設定は 1）。 */
export function pickerRankForSelection(
  selectedQuarters: string[],
  draft: Map<string, Rank>,
): Rank {
  const qs = selectedQuarters[0];
  if (!qs) return DEFAULT_PICKER_RANK;
  return rankForQuarter(qs, draft);
}
