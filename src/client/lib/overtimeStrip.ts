import type { OvertimeHours } from "@shared/income";
import type { MonthlyOvertimeDTO } from "@shared/types";

/** 月 → 残業時間の下書き。 */
export type OvertimeDraft = Map<string, OvertimeHours>;

export const EMPTY_OVERTIME: OvertimeHours = {
  normalHours: 0,
  nightHours: 0,
  holidayHours: 0,
};

export function buildOvertimeDraftFromDashboard(
  overtime: MonthlyOvertimeDTO[],
): OvertimeDraft {
  const draft: OvertimeDraft = new Map();
  for (const o of overtime) {
    draft.set(o.yearMonth, {
      normalHours: o.normalHours,
      nightHours: o.nightHours,
      holidayHours: o.holidayHours,
    });
  }
  return draft;
}

export function overtimeForMonth(
  draft: OvertimeDraft,
  ym: string,
): OvertimeHours {
  return draft.get(ym) ?? { ...EMPTY_OVERTIME };
}

/** 選択月に同じ残業時間を一括適用する。 */
export function applyOvertimeTemplate(
  draft: OvertimeDraft,
  months: Iterable<string>,
  hours: OvertimeHours,
): OvertimeDraft {
  const next = new Map(draft);
  const template = { ...hours };
  for (const ym of months) {
    next.set(ym, { ...template });
  }
  return next;
}

/** 残業バッジ（通常時間が 0 より大きいときのみ）。 */
export function overtimeBadgeLabel(hours: OvertimeHours): string | null {
  if (hours.normalHours <= 0) return null;
  const h = hours.normalHours;
  return `${h}h`;
}

export function overtimeEqual(a: OvertimeHours, b: OvertimeHours): boolean {
  return (
    a.normalHours === b.normalHours &&
    a.nightHours === b.nightHours &&
    a.holidayHours === b.holidayHours
  );
}
