import { useEffect, useState, type ReactNode } from "react";
import { Button, Dropdown, Label } from "@heroui/react";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function parseYm(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-").map(Number);
  return { year: y, month: m };
}

function formatYm(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatYmLabel(ym: string): string {
  const { year, month } = parseYm(ym);
  return `${year}年${month}月`;
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted shrink-0"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

/** "YYYY-MM" 形式の年月入力（年ナビ + 12ヶ月グリッド）。 */
export function YearMonthField({
  label,
  value,
  onChange,
  className,
  isRequired,
  description,
}: {
  label: string;
  value: string;
  onChange: (ym: string) => void;
  className?: string;
  isRequired?: boolean;
  description?: ReactNode;
}) {
  const { year, month } = parseYm(value);
  const [open, setOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(year);

  useEffect(() => {
    if (open) setDraftYear(year);
  }, [open, year]);

  const selectMonth = (m: number) => {
    onChange(formatYm(draftYear, m));
    setOpen(false);
  };

  return (
    <div className={className ?? "year-month-field w-40"}>
      <Label>{label}</Label>
      {isRequired && <input type="hidden" value={value} required />}
      <Dropdown isOpen={open} onOpenChange={setOpen}>
        <Dropdown.Trigger
          className="year-month-field__trigger"
          aria-label={`${label}: ${formatYmLabel(value)}`}
        >
          <span className="year-month-field__value">{formatYmLabel(value)}</span>
          <CalendarIcon />
        </Dropdown.Trigger>
        <Dropdown.Popover className="year-month-picker p-3">
          <div className="year-month-picker__header">
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              aria-label="前の年"
              onPress={() => setDraftYear((y) => y - 1)}
            >
              ‹
            </Button>
            <span className="year-month-picker__year">{draftYear}年</span>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              aria-label="次の年"
              onPress={() => setDraftYear((y) => y + 1)}
            >
              ›
            </Button>
          </div>
          <div className="year-month-picker__grid" aria-label={`${draftYear}年の月`}>
            {MONTHS.map((m) => {
              const selected = draftYear === year && m === month;
              return (
                <Button
                  key={m}
                  variant={selected ? "primary" : "secondary"}
                  size="sm"
                  aria-label={`${draftYear}年${m}月`}
                  onPress={() => selectMonth(m)}
                >
                  {m}月
                </Button>
              );
            })}
          </div>
        </Dropdown.Popover>
      </Dropdown>
      {description && (
        <p className="text-muted mt-1 text-xs">{description}</p>
      )}
    </div>
  );
}
