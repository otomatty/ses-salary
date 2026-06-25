import {
  ALLOWANCE_MASTER,
  type AllowanceDefinition,
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
  /** マスタ外（旧データ）手当の残業基礎フラグ。 */
  includeInOvertimeBase?: boolean;
}

/** 手当未追加の初期状態（空リスト）。 */
export function emptyMasterRows(): AllowanceMasterRowDraft[] {
  return [];
}

/** まだ追加されていないマスタ手当（追加時の候補）を返す。 */
export function availableAllowanceCandidates(
  rows: AllowanceMasterRowDraft[],
): AllowanceDefinition[] {
  const used = new Set(rows.map((r) => r.name));
  return ALLOWANCE_MASTER.filter((def) => !used.has(def.name));
}

/**
 * 手当名から行を1件生成する。
 * マスタ登録名なら既定額・残業基礎をマスタから引き継ぎ、
 * 任意名称なら金額未入力・残業基礎OFFを初期値とする。
 */
export function makeAllowanceRow(name: string): AllowanceMasterRowDraft {
  const trimmed = name.trim();
  const def = findAllowanceDefinition(trimmed);
  return {
    name: trimmed,
    enabled: true,
    amountManYen:
      def?.defaultAmount != null ? yenToManYen(def.defaultAmount) : null,
    includeInOvertimeBase: def ? def.includeInOvertimeBase : false,
  };
}

/** 保存済み手当から追加済みの行リストを復元する（保存されている手当のみ）。 */
export function masterRowsFromItems(
  items: MonthlyAllowanceItem[],
): AllowanceMasterRowDraft[] {
  return items.map((item) => {
    const def = findAllowanceDefinition(item.name);
    return {
      name: item.name,
      enabled: true,
      amountManYen: yenToManYen(item.amount),
      includeInOvertimeBase: def
        ? def.includeInOvertimeBase
        : item.includeInOvertimeBase,
    };
  });
}

export function masterRowsFromDtos(
  allowances: AllowanceDTO[],
): AllowanceMasterRowDraft[] {
  const items: MonthlyAllowanceItem[] = [];
  for (const a of allowances) {
    const normalized = normalizeAllowanceItem(a.name, a.amount);
    if ("error" in normalized) {
      items.push({
        name: a.name,
        amount: a.amount,
        includeInOvertimeBase: a.includeInOvertimeBase,
      });
    } else {
      items.push(normalized);
    }
  }
  return masterRowsFromItems(items);
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
    const def = findAllowanceDefinition(r.name);
    if (def) {
      const normalized = normalizeAllowanceItem(
        r.name,
        manYenToYen(r.amountManYen),
      );
      if ("error" in normalized) continue;
      items.push(normalized);
      continue;
    }
    items.push({
      name: r.name,
      amount: manYenToYen(r.amountManYen),
      includeInOvertimeBase: r.includeInOvertimeBase ?? false,
    });
  }
  return items;
}

export function validateMasterRows(rows: AllowanceMasterRowDraft[]): string | null {
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.enabled) continue;
    const name = r.name.trim();
    if (!name) {
      return "手当名を入力してください。";
    }
    if (seen.has(name)) {
      return `手当名が重複しています（${name}）。`;
    }
    seen.add(name);
    if (
      r.amountManYen == null ||
      !Number.isFinite(r.amountManYen) ||
      r.amountManYen < 0
    ) {
      return `${name}の金額を正しく入力してください（万円）。`;
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
