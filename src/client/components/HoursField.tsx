import { Label, NumberField } from "@heroui/react";

/** 時間入力フィールド（0以上、0.5h刻み）。空欄は 0 として扱う。 */
export function HoursField({
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
