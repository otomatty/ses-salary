import { useMemo } from "react";
import type { ReactNode } from "react";
import { currentYearMonth } from "@shared/periods";
import type { AllowanceDTO, RankHistoryDTO, UserSettingsDTO } from "@shared/types";
import type { MonthlyAllowanceItem } from "@shared/income";
import {
  allowancesEqual,
  buildAllowanceDraftFromDashboard,
  type AllowanceDraft,
} from "../lib/allowanceStrip";
import { usePayableDraftForm } from "../lib/usePayableDraftForm";
import { AllowanceYearEditor } from "./AllowanceYearEditor";
import { PayableMonthFormShell } from "./PayableMonthFormShell";

const getAllowanceValue = (
  draft: AllowanceDraft,
  ym: string,
): MonthlyAllowanceItem[] => draft.get(ym) ?? [];

/**
 * 特別手当の設定フォーム（12ヶ月ストリップ＋保存）。
 * オンボーディング等から利用する。
 */
export function AllowanceForm({
  allowances,
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
  allowances: AllowanceDTO[];
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
    () => buildAllowanceDraftFromDashboard(allowances),
    [allowances],
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
    getValue: getAllowanceValue,
    equal: allowancesEqual,
    toSavePayload: (items) => ({ allowances: items }),
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
        <AllowanceYearEditor
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
