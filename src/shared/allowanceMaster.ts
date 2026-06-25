import type { MonthlyAllowanceItem } from "./income";

/** システム固定の手当マスタ1件。 */
export interface AllowanceDefinition {
  name: string;
  /** 残業単価の基礎（基本給＋TL手当等）に算入するか。 */
  includeInOvertimeBase: boolean;
  /** 既定の支給額（円）。null ならユーザー入力。 */
  defaultAmount: number | null;
}

/**
 * 全ユーザー共通の手当マスタ（手当を追加する際の候補）。
 * 労基法の割増賃金「除外賃金」を踏まえ、通勤・住宅・家族手当は残業基礎に含めない。
 */
export const ALLOWANCE_MASTER: readonly AllowanceDefinition[] = [
  { name: "TL手当", includeInOvertimeBase: true, defaultAmount: 20_000 },
  { name: "役職手当", includeInOvertimeBase: true, defaultAmount: null },
  { name: "資格手当", includeInOvertimeBase: true, defaultAmount: null },
  { name: "通勤手当", includeInOvertimeBase: false, defaultAmount: null },
  { name: "住宅手当", includeInOvertimeBase: false, defaultAmount: null },
  { name: "家族手当", includeInOvertimeBase: false, defaultAmount: null },
] as const;

const masterByName = new Map(
  ALLOWANCE_MASTER.map((d) => [d.name, d] as const),
);

export function findAllowanceDefinition(
  name: string,
): AllowanceDefinition | undefined {
  return masterByName.get(name.trim());
}

export function isKnownAllowanceName(name: string): boolean {
  return masterByName.has(name.trim());
}

export function allowanceMasterNames(): string[] {
  return ALLOWANCE_MASTER.map((d) => d.name);
}

/** 手当名・金額をマスタに照合して正規化する（サーバ・クライアント共通）。 */
export function normalizeAllowanceItem(
  name: string,
  amount: number,
): MonthlyAllowanceItem | { error: string } {
  const trimmed = name.trim();
  const def = findAllowanceDefinition(trimmed);
  if (!def) {
    return { error: `未登録の手当名です（${trimmed}）。` };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "手当額は0以上の妥当な金額で入力してください。" };
  }
  return {
    name: trimmed,
    amount: Math.round(amount),
    includeInOvertimeBase: def.includeInOvertimeBase,
  };
}
