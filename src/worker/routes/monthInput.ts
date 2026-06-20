import type { MonthlyAllowanceItem } from "@shared/income";
import { normalizeAllowanceItem } from "@shared/allowanceMaster";
import type { MonthlyEntryRow } from "../db/schema";

/** 単価（0以上1億円未満の有限数値）か検証する。 */
export function isValidUnitPrice(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isFinite(v) &&
    v >= 0 &&
    v <= 100_000_000
  );
}

/** 残業時間（0以上の妥当な数値）か検証する。 */
export function isValidHours(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 744;
}

export type MonthUpsertBody = {
  unitPrice?: unknown;
  overtime?: {
    normalHours?: unknown;
    nightHours?: unknown;
    holidayHours?: unknown;
  };
  allowances?: unknown;
};

export type ResolvedMonthUpsert = {
  unitPrice: number;
  overtime: {
    normalHours: number;
    nightHours: number;
    holidayHours: number;
  };
  replaceAllowances: boolean;
  allowances: MonthlyAllowanceItem[];
};

/** 手当ペイロードを検証して正規化する（不正なら文字列でエラーを返す）。 */
export function normalizeAllowances(
  input: unknown,
): { items: MonthlyAllowanceItem[] } | { error: string } {
  if (input == null) return { items: [] };
  if (!Array.isArray(input)) return { error: "手当の形式が不正です。" };
  const items: MonthlyAllowanceItem[] = [];
  const seen = new Set<string>();
  for (const a of input) {
    const name = typeof (a as { name?: unknown })?.name === "string"
      ? ((a as { name: string }).name).trim()
      : "";
    const amount = (a as { amount?: unknown })?.amount;
    if (!name) return { error: "手当名を入力してください。" };
    if (seen.has(name)) {
      return { error: `手当名が重複しています（${name}）。` };
    }
    seen.add(name);
    if (!isValidUnitPrice(amount)) {
      return { error: "手当額は0以上の妥当な金額で入力してください。" };
    }
    const includeInOvertimeBase =
      (a as { includeInOvertimeBase?: unknown }).includeInOvertimeBase === true;
    const normalized = normalizeAllowanceItem(name, amount as number);
    if ("error" in normalized) {
      items.push({
        name,
        amount: Math.round(amount as number),
        includeInOvertimeBase,
      });
    } else {
      items.push(normalized);
    }
  }
  return { items };
}

function overtimeFromExisting(
  existing: MonthlyEntryRow | undefined,
): ResolvedMonthUpsert["overtime"] {
  return {
    normalHours: existing?.overtimeNormalHours ?? 0,
    nightHours: existing?.overtimeNightHours ?? 0,
    holidayHours: existing?.overtimeHolidayHours ?? 0,
  };
}

function resolveUnitPrice(
  body: MonthUpsertBody | null,
  existing: MonthlyEntryRow | undefined,
): number | { error: string } {
  if (body?.unitPrice !== undefined) {
    if (!isValidUnitPrice(body.unitPrice)) {
      return { error: "単価は0以上の妥当な金額で入力してください。" };
    }
    return Math.round(body.unitPrice);
  }
  return existing?.unitPrice ?? 0;
}

function resolveOvertime(
  body: MonthUpsertBody | null,
  existing: MonthlyEntryRow | undefined,
): ResolvedMonthUpsert["overtime"] | { error: string } {
  if (body?.overtime === undefined) {
    return overtimeFromExisting(existing);
  }
  const overtime = body.overtime ?? {};
  const normalHours = overtime.normalHours ?? 0;
  const nightHours = overtime.nightHours ?? 0;
  const holidayHours = overtime.holidayHours ?? 0;
  if (
    !isValidHours(normalHours) ||
    !isValidHours(nightHours) ||
    !isValidHours(holidayHours)
  ) {
    return { error: "残業時間は0以上の妥当な時間で入力してください。" };
  }
  return { normalHours, nightHours, holidayHours };
}

function resolveAllowances(
  body: MonthUpsertBody | null,
): { replaceAllowances: false } | { replaceAllowances: true; items: MonthlyAllowanceItem[] } | { error: string } {
  if (body?.allowances === undefined) {
    return { replaceAllowances: false };
  }
  const parsed = normalizeAllowances(body.allowances);
  if ("error" in parsed) return parsed;
  return { replaceAllowances: true, items: parsed.items };
}

/**
 * POST /api/months/:yearMonth のボディを既存行とマージして正規化する。
 */
export function resolveMonthUpsert(
  body: unknown,
  existing: MonthlyEntryRow | undefined,
): ResolvedMonthUpsert | { error: string } {
  if (
    body == null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return { error: "リクエスト形式が不正です。" };
  }
  const patch = body as MonthUpsertBody;

  const unitPrice = resolveUnitPrice(patch, existing);
  if (typeof unitPrice !== "number") return unitPrice;

  const overtime = resolveOvertime(patch, existing);
  if ("error" in overtime) return overtime;

  const allowances = resolveAllowances(patch);
  if ("error" in allowances) return allowances;

  return {
    unitPrice,
    overtime,
    replaceAllowances: allowances.replaceAllowances,
    allowances: allowances.replaceAllowances ? allowances.items : [],
  };
}

/** 部分更新時に onConflictDoUpdate で上書きする列だけを返す。 */
export function buildMonthEntryConflictSet(
  patch: MonthUpsertBody,
  resolved: ResolvedMonthUpsert,
  now: number,
): {
  updatedAt: number;
  unitPrice?: number;
  overtimeNormalHours?: number;
  overtimeNightHours?: number;
  overtimeHolidayHours?: number;
} {
  const set: {
    updatedAt: number;
    unitPrice?: number;
    overtimeNormalHours?: number;
    overtimeNightHours?: number;
    overtimeHolidayHours?: number;
  } = { updatedAt: now };
  if (patch.unitPrice !== undefined) {
    set.unitPrice = resolved.unitPrice;
  }
  if (patch.overtime !== undefined) {
    set.overtimeNormalHours = resolved.overtime.normalHours;
    set.overtimeNightHours = resolved.overtime.nightHours;
    set.overtimeHolidayHours = resolved.overtime.holidayHours;
  }
  return set;
}
