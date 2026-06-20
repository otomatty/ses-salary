import { Chip, Label } from "@heroui/react";
import { findAllowanceDefinition } from "@shared/allowanceMaster";
import {
  defaultAmountManYenForMaster,
  type AllowanceMasterRowDraft,
} from "../lib/allowanceStrip";
import { ManYenField } from "./ManYenField";

/** 手当マスタから複数選択し、金額を入力するエディタ。 */
export function AllowanceRowsEditor({
  rows,
  onChange,
}: {
  rows: AllowanceMasterRowDraft[];
  onChange: (rows: AllowanceMasterRowDraft[]) => void;
}) {
  const updateRow = (name: string, patch: Partial<AllowanceMasterRowDraft>) =>
    onChange(rows.map((r) => (r.name === name ? { ...r, ...patch } : r)));

  const toggleEnabled = (name: string, enabled: boolean) => {
    const row = rows.find((r) => r.name === name);
    if (!row) return;
    const patch: Partial<AllowanceMasterRowDraft> = { enabled };
    if (enabled && row.amountManYen == null) {
      patch.amountManYen = defaultAmountManYenForMaster(name);
    }
    updateRow(name, patch);
  };

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const def = findAllowanceDefinition(r.name);
        const inputId = `allowance-${r.name}`;
        return (
          <div
            key={r.name}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-default-200 px-2 py-2"
          >
            <div className="flex min-w-[8rem] items-center gap-2 pb-1">
              <input
                id={inputId}
                type="checkbox"
                checked={r.enabled}
                onChange={(e) => toggleEnabled(r.name, e.target.checked)}
                className="size-4 shrink-0 accent-[var(--accent)]"
                aria-label={`${r.name}を付与する`}
              />
              <Label htmlFor={inputId} className="text-sm font-medium">
                {r.name}
              </Label>
            </div>
            <ManYenField
              label="金額"
              value={r.enabled ? r.amountManYen : null}
              onChange={(v) => updateRow(r.name, { amountManYen: v })}
              placeholder={
                def?.defaultAmount != null ? "既定あり" : "例: 2"
              }
              className="man-yen-field w-36"
            />
            {(def ? def.includeInOvertimeBase : r.includeInOvertimeBase) ? (
              <Chip size="sm" variant="soft" color="accent" className="mb-1">
                残業基礎
              </Chip>
            ) : (
              <Chip size="sm" variant="soft" className="text-muted mb-1">
                残業基礎外
              </Chip>
            )}
            {!def ? (
              <Chip size="sm" variant="soft" className="text-muted mb-1">
                旧データ
              </Chip>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
