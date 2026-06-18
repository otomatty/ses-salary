import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Disclosure,
  Input,
  Label,
  NumberField,
  TextField,
} from "@heroui/react";
import { currentYearMonth } from "@shared/periods";
import { api } from "../api";

/** 既存月の「編集」で残業フォームへ流し込む対象。 */
export interface OvertimeEditTarget {
  yearMonth: string;
  normalHours: number;
  nightHours: number;
  holidayHours: number;
}

/** 時間入力フィールド（0以上、0.5h刻み）。空欄は 0 として扱う。 */
function HoursField({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  description?: string;
}) {
  return (
    <NumberField
      value={value}
      onChange={(v) => onChange(Number.isNaN(v) ? 0 : v)}
      minValue={0}
      step={0.5}
      formatOptions={{ useGrouping: true, maximumFractionDigits: 2 }}
    >
      <Label>{label}</Label>
      <NumberField.Group>
        <NumberField.Input placeholder="例: 20" />
        <span className="text-muted px-2 text-sm">時間</span>
      </NumberField.Group>
      {description && <p className="text-muted mt-1 text-xs">{description}</p>}
    </NumberField>
  );
}

/**
 * 月次残業時間の入力フォーム。
 * 通常残業時間を主入力とし、深夜・法定休日は折りたたみ（Disclosure）のオプション。
 * 既存月の「編集」操作（editTarget の差し替え）でフォームへ値を反映する。
 */
export function OvertimeForm({
  reload,
  editTarget,
}: {
  reload: () => Promise<void>;
  editTarget?: OvertimeEditTarget | null;
}) {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [normalHours, setNormalHours] = useState(0);
  const [nightHours, setNightHours] = useState(0);
  const [holidayHours, setHolidayHours] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editTarget) return;
    setYearMonth(editTarget.yearMonth);
    setNormalHours(editTarget.normalHours);
    setNightHours(editTarget.nightHours);
    setHolidayHours(editTarget.holidayHours);
    setError(null);
  }, [editTarget]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.saveOvertime({ yearMonth, normalHours, nightHours, holidayHours });
      setNormalHours(0);
      setNightHours(0);
      setHolidayHours(0);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const hasOptional = nightHours > 0 || holidayHours > 0;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <TextField value={yearMonth} onChange={setYearMonth} isRequired>
          <Label>年月</Label>
          <Input type="month" />
        </TextField>
        <HoursField
          label="通常残業時間"
          value={normalHours}
          onChange={setNormalHours}
        />
        <Button type="submit" variant="primary" isDisabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>

      <Disclosure defaultExpanded={hasOptional}>
        <Disclosure.Heading>
          <Disclosure.Trigger>
            深夜・法定休日（任意）
            <Disclosure.Indicator />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="flex flex-wrap items-start gap-3 pt-3">
            <HoursField
              label="深夜労働"
              value={nightHours}
              onChange={setNightHours}
              description="22:00〜5:00。割増は加算分 +0.25。"
            />
            <HoursField
              label="法定休日労働"
              value={holidayHours}
              onChange={setHolidayHours}
              description="割増率 1.35。"
            />
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>

      {error && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <p className="text-muted text-xs">
        残業代は{" "}
        <strong className="text-foreground">
          (基本給 + 職務手当) ÷ 月平均所定労働時間 × 割増率
        </strong>{" "}
        で算出します。みなし残業（固定時間外手当）を超えた分のみ加算されます。同じ年月を保存すると上書き更新されます。
      </p>
    </form>
  );
}
