import {
  ALLOWANCE_MASTER,
  findAllowanceDefinition,
  normalizeAllowanceItem,
} from "@shared/allowanceMaster";
import type { MonthlyAllowanceItem } from "@shared/income";
import { formatYen, manYenToYen, yenToManYen } from "@shared/calc";
import type { AllowanceDTO } from "@shared/types";

/** 月 → 手当一覧の下書き。 */
export type AllowanceDraft = Map<string, MonthlyAllowanceItem[]>;

/** マスタ1件分の選択状態（UI用）。 */
export interface AllowanceMasterRowDraft {
  name: string;
  enabled: boolean;
  /** 万円単位。空欄は null。 */
  amountManYen: number | null;
}

export function defaultAmountManYenForMaster(name: string): number | null {
  const def = findAllowanceDefinition(name);
  if (!def?.defaultAmount) return null;
  return yenToManYen(def.defaultAmount);
}

/** マスタ全件の未選択状態を生成する。 */
export function emptyMasterRows(): AllowanceMasterRowDraft[] {
  return ALLOWANCE_MASTER.map((def) => ({
    name: def.name,
    enabled: false,
    amountManYen: def.defaultAmount != null ? yenToManYen(def.defaultAmount) : null,
  }));
}

/** 保存済み手当からマスタ選択状態を復元する。 */
export function masterRowsFromItems(
  items: MonthlyAllowanceItem[],
): AllowanceMasterRowDraft[] {
  const byName = new Map(items.map((i) => [i.name, i]));
  return ALLOWANCE_MASTER.map((def) => {
    const item = byName.get(def.name);
    if (item) {
      return {
        name: def.name,
        enabled: true,
        amountManYen: yenToManYen(item.amount),
      };
    }
    return {
      name: def.name,
      enabled: false,
      amountManYen:
        def.defaultAmount != null ? yenToManYen(def.defaultAmount) : null,
    };
  });
}

export function masterRowsFromDtos(
  allowances: AllowanceDTO[],
): AllowanceMasterRowDraft[] {
  return masterRowsFromItems(
    allowances.flatMap((a) => {
      const normalized = normalizeAllowanceItem(a.name, a.amount);
      return "error" in normalized ? [] : [normalized];
    }),
  );
}

/** マスタ選択状態を保存用の手当一覧に変換する。 */
export function masterRowsToItems(
  rows: AllowanceMasterRowDraft[],
): MonthlyAllowanceItem[] {
  const items: MonthlyAllowanceItem[] = [];
  for (const r of rows) {
    if (!r.enabled) continue;
    if (r.amountManYen == null || !Number.isFinite(r.amountManYen) || r.amountManYen < 0) {
      continue;
    }
    const normalized = normalizeAllowanceItem(r.name, manYenToYen(r.amountManYen));
    if ("error" in normalized) continue;
    items.push(normalized);
  }
  return items;
}

export function validateMasterRows(rows: AllowanceMasterRowDraft[]): string | null {
  for (const r of rows) {
    if (!r.enabled) continue;
    if (
      r.amountManYen == null ||
      !Number.isFinite(r.amountManYen) ||
      r.amountManYen < 0
    ) {
      return `${r.name}の金額を正しく入力してください（万円）。`;
    }
    if (!findAllowanceDefinition(r.name)) {
      return `未登録の手当名です（${r.name}）。`;
    }
  }
  return null;
}

/** ダッシュボードの手当から下書き Map を構築する。 */
export function buildAllowanceDraftFromDashboard(
  allowances: AllowanceDTO[],
): AllowanceDraft {
  const draft: AllowanceDraft = new Map();
  for (const a of allowances) {
    const normalized = normalizeAllowanceItem(a.name, a.amount);
    const item =
      "error" in normalized
        ? {
            name: a.name,
            amount: a.amount,
            includeInOvertimeBase: a.includeInOvertimeBase,
          }
        : normalized;
    const list = draft.get(a.yearMonth) ?? [];
    list.push(item);
    draft.set(a.yearMonth, list);
  }
  return draft;
}

function cloneItems(items: MonthlyAllowanceItem[]): MonthlyAllowanceItem[] {
  return items.map((i) => ({ ...i }));
}

/** 選択月に同じ手当テンプレートを一括適用する。 */
export function applyAllowanceTemplate(
  draft: AllowanceDraft,
  months: Iterable<string>,
  items: MonthlyAllowanceItem[],
): AllowanceDraft {
  const next = new Map(draft);
  const template = cloneItems(items);
  for (const ym of months) {
    next.set(ym, cloneItems(template));
  }
  return next;
}

/** 手当合計のバッジ表示用ラベル。 */
export function allowanceBadgeLabel(items: MonthlyAllowanceItem[]): string | null {
  const total = items.reduce((s, i) => s + (i.amount > 0 ? i.amount : 0), 0);
  if (total <= 0) return null;
  if (total >= 10_000) return `${Math.floor(total / 10_000)}万`;
  return formatYen(total).replace(/,/g, "");
}

export function allowancesEqual(
  a: MonthlyAllowanceItem[],
  b: MonthlyAllowanceItem[],
): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x.name.localeCompare(y.name));
  const sb = [...b].sort((x, y) => x.name.localeCompare(y.name));
  return sa.every(
    (item, i) =>
      item.name === sb[i]!.name &&
      item.amount === sb[i]!.amount &&
      item.includeInOvertimeBase === sb[i]!.includeInOvertimeBase,
  );
}
