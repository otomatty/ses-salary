import { useState } from "react";
import { Button, Chip, Input, Label, TextField } from "@heroui/react";
import { findAllowanceDefinition } from "@shared/allowanceMaster";
import {
  availableAllowanceCandidates,
  makeAllowanceRow,
  type AllowanceMasterRowDraft,
} from "../lib/allowanceStrip";
import { ManYenField } from "./ManYenField";

/** 必要な手当を追加して金額を入力するエディタ（追加→選択方式）。 */
export function AllowanceRowsEditor({
  rows,
  onChange,
}: {
  rows: AllowanceMasterRowDraft[];
  onChange: (rows: AllowanceMasterRowDraft[]) => void;
}) {
  const [customName, setCustomName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const candidates = availableAllowanceCandidates(rows);

  const updateRow = (name: string, patch: Partial<AllowanceMasterRowDraft>) =>
    onChange(rows.map((r) => (r.name === name ? { ...r, ...patch } : r)));

  const removeRow = (name: string) =>
    onChange(rows.filter((r) => r.name !== name));

  const addRow = (name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed) {
      setAddError("手当名を入力してください。");
      return false;
    }
    if (rows.some((r) => r.name === trimmed)) {
      setAddError(`「${trimmed}」は既に追加されています。`);
      return false;
    }
    setAddError(null);
    onChange([...rows, makeAllowanceRow(trimmed)]);
    return true;
  };

  const addCustom = () => {
    if (addRow(customName)) setCustomName("");
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-muted text-xs">
          手当はまだありません。下のボタンまたは入力欄から追加してください。
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const def = findAllowanceDefinition(r.name);
            const inBase = def ? def.includeInOvertimeBase : r.includeInOvertimeBase;
            const toggleId = `allowance-otbase-${r.name}`;
            return (
              <div
                key={r.name}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-default-200 px-2 py-2"
              >
                <span className="min-w-[6rem] pb-2 text-sm font-medium">
                  {r.name}
                </span>
                <ManYenField
                  label="金額"
                  value={r.amountManYen}
                  onChange={(v) => updateRow(r.name, { amountManYen: v })}
                  placeholder={def?.defaultAmount != null ? "既定あり" : "例: 2"}
                  className="man-yen-field w-36"
                />
                {def ? (
                  <Chip
                    size="sm"
                    variant="soft"
                    color={inBase ? "accent" : undefined}
                    className={inBase ? "mb-1" : "text-muted mb-1"}
                  >
                    {inBase ? "残業基礎" : "残業基礎外"}
                  </Chip>
                ) : (
                  <label
                    htmlFor={toggleId}
                    className="text-muted mb-1 flex items-center gap-1 text-xs"
                  >
                    <input
                      id={toggleId}
                      type="checkbox"
                      checked={r.includeInOvertimeBase ?? false}
                      onChange={(e) =>
                        updateRow(r.name, {
                          includeInOvertimeBase: e.target.checked,
                        })
                      }
                      className="size-4 shrink-0 accent-[var(--accent)]"
                    />
                    残業基礎に算入
                  </label>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted mb-0.5 ml-auto"
                  onPress={() => removeRow(r.name)}
                  aria-label={`${r.name}を削除`}
                >
                  削除
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-surface-secondary space-y-2 rounded-lg p-3">
        <p className="text-muted text-xs font-medium">手当を追加</p>
        {candidates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {candidates.map((c) => (
              <Button
                key={c.name}
                variant="secondary"
                size="sm"
                onPress={() => addRow(c.name)}
              >
                ＋ {c.name}
              </Button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            value={customName}
            onChange={setCustomName}
            className="min-w-[10rem] flex-1"
          >
            <Label className="text-muted text-xs">任意の手当名</Label>
            <Input
              placeholder="例: 出張手当"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
          </TextField>
          <Button
            variant="primary"
            size="sm"
            className="mb-0.5"
            onPress={addCustom}
            isDisabled={customName.trim() === ""}
          >
            追加
          </Button>
        </div>
        {addError && <p className="text-danger text-xs">{addError}</p>}
      </div>
    </div>
  );
}
