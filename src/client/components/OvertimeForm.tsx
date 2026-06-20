import { useMemo } from "react";
import type { ReactNode } from "react";
import { currentYearMonth } from "@shared/periods";
import type {
  MonthlyOvertimeDTO,
  RankHistoryDTO,
  UserSettingsDTO,
} from "@shared/types";
import type { OvertimeHours } from "@shared/income";
import {
  buildOvertimeDraftFromDashboard,
  EMPTY_OVERTIME,
  overtimeEqual,
  type OvertimeDraft,
} from "../lib/overtimeStrip";
import { usePayableDraftForm } from "../lib/usePayableDraftForm";
import { OvertimeYearEditor } from "./OvertimeYearEditor";
import { PayableMonthFormShell } from "./PayableMonthFormShell";

const getOvertimeValue = (draft: OvertimeDraft, ym: string): OvertimeHours =>
  draft.get(ym) ?? { ...EMPTY_OVERTIME };

/**
 * 残業時間の設定フォーム（12ヶ月ストリップ＋保存）。
 */
export function OvertimeForm({
  overtime,
  priceMap,
  rankHistory,
  settings,
  reload,
  onSaved,
  saveLabel = "保存",
  footer,
  endMonth = currentYearMonth(),
  advanceWithoutChanges = false,
}: {
  overtime: MonthlyOvertimeDTO[];
  priceMap: Map<string, number>;
  rankHistory: RankHistoryDTO[];
  settings: UserSettingsDTO;
  reload: () => Promise<void>;
  onSaved?: () => void;
  saveLabel?: string;
  footer?: (saveButton: ReactNode) => ReactNode;
  endMonth?: string;
  advanceWithoutChanges?: boolean;
}) {
  const serverDraft = useMemo(
    () => buildOvertimeDraftFromDashboard(overtime),
    [overtime],
  );

  const {
    draft,
    setDraft,
    rankDraft,
    consultRate,
    endMonth: stripEnd,
    payableMonths,
    error,
    save,
    saving,
    saveDisabled,
  } = usePayableDraftForm({
    serverDraft,
    getValue: getOvertimeValue,
    equal: overtimeEqual,
    toSavePayload: (hours) => ({ overtime: hours }),
    priceMap,
    rankHistory,
    consultRate: settings.consultRate,
    endMonth,
    advanceWithoutChanges,
    onSaved,
    reload,
  });

  return (
    <PayableMonthFormShell
      payableMonthsEmpty={payableMonths.length === 0}
      error={error}
      footer={footer}
      onSave={save}
      saving={saving}
      saveDisabled={saveDisabled}
      saveLabel={saveLabel}
      editor={
        <OvertimeYearEditor
          value={draft}
          onChange={setDraft}
          priceMap={priceMap}
          rankDraft={rankDraft}
          consultRate={consultRate}
          endMonth={stripEnd}
        />
      }
    />
  );
}
