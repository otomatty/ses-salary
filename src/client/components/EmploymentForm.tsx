import { useState } from "react";
import {
  Alert,
  Button,
  Label,
  NumberField,
  Radio,
  RadioGroup,
} from "@heroui/react";
import {
  EMPLOYMENT_TYPES,
  findEmploymentType,
  type EmploymentTypeKey,
} from "@shared/income";
import type { UserSettingsDTO } from "@shared/types";
import { api } from "../api";

/**
 * 雇用形態・月平均所定労働時間の設定フォーム。
 * 残業代の算出に使う（残業単価の分母＝月平均所定労働時間、みなし残業時間＝雇用形態）。
 */
export function EmploymentForm({
  settings,
  reload,
}: {
  settings: UserSettingsDTO;
  reload: () => Promise<void>;
}) {
  const [employmentType, setEmploymentType] = useState<EmploymentTypeKey>(
    settings.employmentType,
  );
  const [monthlyStandardHours, setMonthlyStandardHours] = useState<
    number | null
  >(settings.monthlyStandardHours);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const deemed = findEmploymentType(employmentType).deemedOvertimeHours;

  const save = async () => {
    setError(null);
    if (
      monthlyStandardHours == null ||
      !Number.isFinite(monthlyStandardHours) ||
      monthlyStandardHours <= 0
    ) {
      setError("月平均所定労働時間を正しく入力してください。");
      return;
    }
    setSaving(true);
    try {
      await api.saveSettings({
        employmentType,
        monthlyStandardHours,
        // みなし時間は雇用形態から導出する（オーバーライドは使わない）。
        deemedOvertimeHours: null,
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <RadioGroup
        value={employmentType}
        onChange={(v) => setEmploymentType(v as EmploymentTypeKey)}
      >
        <Label>雇用形態</Label>
        <div className="flex flex-col gap-2">
          {EMPLOYMENT_TYPES.map((t) => (
            <Radio key={t.key} value={t.key}>
              {t.label}
              <span className="text-muted ml-2 text-xs">
                （みなし残業 {t.deemedOvertimeHours} 時間）
              </span>
            </Radio>
          ))}
        </div>
      </RadioGroup>

      <NumberField
        value={monthlyStandardHours ?? NaN}
        onChange={(v) => setMonthlyStandardHours(Number.isNaN(v) ? null : v)}
        minValue={1}
        step={1}
        isRequired
        className="max-w-xs"
        formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
      >
        <Label>月平均所定労働時間</Label>
        <NumberField.Group>
          <NumberField.Input placeholder="例: 160" />
          <span className="text-muted px-2 text-sm">時間</span>
        </NumberField.Group>
        <p className="text-muted mt-1 text-xs">
          残業単価の分母です（規程の「1ヶ月平均所定労働時間」）。
        </p>
      </NumberField>

      <p className="text-muted text-xs">
        現在の設定では、月{" "}
        <strong className="text-foreground">{deemed} 時間</strong>{" "}
        までの残業は基本給（みなし残業）に含まれ、これを超えた分のみ残業代として加算されます。
      </p>

      {error && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Button variant="primary" onPress={save} isDisabled={saving}>
        {saving ? "保存中…" : "保存して再計算"}
      </Button>
    </div>
  );
}
