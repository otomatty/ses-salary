import { Label, NumberField } from "@heroui/react";

/** 万円単位の金額入力。空欄は null として扱う。 */
export function ManYenField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <NumberField
      className={className ?? "man-yen-field w-40"}
      value={value ?? NaN}
      onChange={(v) => onChange(Number.isNaN(v) ? null : v)}
      minValue={0}
      step={1}
      formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
    >
      <Label>{label}</Label>
      <NumberField.Group>
        <NumberField.Input
          placeholder={placeholder ?? "例: 80"}
          inputMode="decimal"
        />
        <span className="man-yen-field__suffix text-muted text-sm">万円</span>
      </NumberField.Group>
    </NumberField>
  );
}
