import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Disclosure,
  Input,
  Label,
  NumberField,
  TextField,
} from "@heroui/react";
import type { AllowanceDTO, DashboardResponse } from "@shared/types";
import {
  formatYen,
  manYenToYen,
  yenToManYen,
} from "@shared/calc";
import {
  computeSalaryForQuarter,
  currentYearMonth,
  quarterStartMonth,
  type RankHistoryEntry,
} from "@shared/periods";
import { buildMonthlyIncome, type UserSettings } from "@shared/income";
import { api } from "../api";

/** 1ヶ月分の編集対象（カードの初期値）。 */
interface MonthData {
  unitPrice: number;
  normalHours: number;
  nightHours: number;
  holidayHours: number;
  allowances: AllowanceDTO[];
}

const EMPTY_MONTH: MonthData = {
  unitPrice: 0,
  normalHours: 0,
  nightHours: 0,
  holidayHours: 0,
  allowances: [],
};

/**
 * 月別入力ページ。
 * 1ヶ月＝1カードで、その月の「単価・残業時間・手当」をまとめて入力・保存する。
 * 右肩に当月の総支給見込み（基本給＋手当＋残業代）をリアルタイム表示する。
 */
export function Prices({
  dashboard,
  reload,
  error,
}: {
  dashboard: DashboardResponse;
  reload: () => Promise<void>;
  error: string | null;
}) {
  // ダッシュボードの3配列を月ごとにまとめる。
  const monthMap = useMemo(() => {
    const map = new Map<string, MonthData>();
    const ensure = (ym: string) =>
      map.get(ym) ?? map.set(ym, { ...EMPTY_MONTH, allowances: [] }).get(ym)!;
    for (const p of dashboard.prices) {
      ensure(p.yearMonth).unitPrice = p.unitPrice;
    }
    for (const o of dashboard.overtime) {
      const m = ensure(o.yearMonth);
      m.normalHours = o.normalHours;
      m.nightHours = o.nightHours;
      m.holidayHours = o.holidayHours;
    }
    for (const a of dashboard.allowances) {
      ensure(a.yearMonth).allowances.push(a);
    }
    return map;
  }, [dashboard]);

  // 給与（基本給）算出のための前提データ。
  const priceMap = useMemo(
    () => new Map(dashboard.prices.map((p) => [p.yearMonth, p.unitPrice])),
    [dashboard.prices],
  );
  const rankHistory = useMemo<RankHistoryEntry[]>(
    () =>
      dashboard.rankHistory.map((r) => ({
        effectiveFrom: r.effectiveFrom,
        rank: r.rank,
      })),
    [dashboard.rankHistory],
  );

  // 新規追加した未保存の月（ダッシュボードにまだ無い月）。
  const [draftMonths, setDraftMonths] = useState<string[]>([]);
  const [newMonth, setNewMonth] = useState(currentYearMonth());
  const [addError, setAddError] = useState<string | null>(null);

  // 表示する月の一覧（既存 ∪ ドラフト）を新しい順に。
  const months = useMemo(() => {
    const set = new Set<string>([...monthMap.keys(), ...draftMonths]);
    return [...set].sort((a, b) => (a < b ? 1 : -1));
  }, [monthMap, draftMonths]);

  // 直近月の手当を引き継ぐ（職務手当などが毎月続くため再入力を省く）。
  const latestAllowances = useMemo<AllowanceDTO[]>(() => {
    const latest = [...monthMap.keys()].sort((a, b) => (a < b ? 1 : -1))[0];
    return latest ? (monthMap.get(latest)?.allowances ?? []) : [];
  }, [monthMap]);

  const addMonth = () => {
    setAddError(null);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(newMonth)) {
      setAddError("年月の形式が不正です（YYYY-MM）。");
      return;
    }
    if (monthMap.has(newMonth) || draftMonths.includes(newMonth)) {
      setAddError("その月はすでに入力欄があります。");
      return;
    }
    setDraftMonths((prev) => [...prev, newMonth]);
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Card>
        <Card.Header>
          <Card.Title className="text-sm">月を追加</Card.Title>
          <Card.Description className="text-xs">
            入力したい月を選んで追加すると、その月のカードが開きます。単価・残業・手当をまとめて入力できます。
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="flex flex-wrap items-end gap-3">
            <TextField value={newMonth} onChange={setNewMonth} isRequired>
              <Label>年月</Label>
              <Input type="month" />
            </TextField>
            <Button variant="primary" onPress={addMonth}>
              月を追加
            </Button>
          </div>
          {addError && (
            <Alert status="danger" className="mt-3">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{addError}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
        </Card.Content>
      </Card>

      {months.length === 0 ? (
        <Card>
          <Card.Content>
            <p className="text-muted py-6 text-center text-sm">
              まだ入力がありません。上の「月を追加」から始めてください。
            </p>
          </Card.Content>
        </Card>
      ) : (
        months.map((ym) => (
          <MonthCard
            key={ym}
            yearMonth={ym}
            initial={
              monthMap.get(ym) ?? {
                ...EMPTY_MONTH,
                allowances: latestAllowances,
              }
            }
            priceMap={priceMap}
            rankHistory={rankHistory}
            settings={dashboard.settings}
            isNew={!monthMap.has(ym)}
            reload={reload}
            onRemoveDraft={() =>
              setDraftMonths((prev) => prev.filter((m) => m !== ym))
            }
          />
        ))
      )}
    </div>
  );
}

/** カード内で編集する手当の行（amount は空欄許容）。 */
interface AllowanceRow {
  name: string;
  amount: number | null;
  includeInOvertimeBase: boolean;
}

function toRow(a: AllowanceDTO): AllowanceRow {
  return {
    name: a.name,
    amount: a.amount,
    includeInOvertimeBase: a.includeInOvertimeBase,
  };
}

/** 1ヶ月分の入力カード。 */
function MonthCard({
  yearMonth,
  initial,
  priceMap,
  rankHistory,
  settings,
  isNew,
  reload,
  onRemoveDraft,
}: {
  yearMonth: string;
  initial: MonthData;
  priceMap: Map<string, number>;
  rankHistory: RankHistoryEntry[];
  settings: UserSettings;
  isNew: boolean;
  reload: () => Promise<void>;
  onRemoveDraft: () => void;
}) {
  const [priceMan, setPriceMan] = useState<number | null>(
    initial.unitPrice > 0 ? yenToManYen(initial.unitPrice) : null,
  );
  const [normalHours, setNormalHours] = useState(initial.normalHours);
  const [nightHours, setNightHours] = useState(initial.nightHours);
  const [holidayHours, setHolidayHours] = useState(initial.holidayHours);
  const [rows, setRows] = useState<AllowanceRow[]>(
    initial.allowances.map(toRow),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 当月の基本給（この月が属する四半期に適用される給与）を求める。
  const baseSalary = useMemo(() => {
    const result = computeSalaryForQuarter(
      quarterStartMonth(yearMonth),
      priceMap,
      rankHistory,
    );
    return result?.breakdown.salary ?? null;
  }, [yearMonth, priceMap, rankHistory]);

  // 総支給見込みのリアルタイム計算。
  const income = useMemo(
    () =>
      buildMonthlyIncome({
        yearMonth,
        baseSalary,
        settings,
        allowances: rows.map((r) => ({
          name: r.name.trim(),
          amount: r.amount ?? 0,
          includeInOvertimeBase: r.includeInOvertimeBase,
        })),
        overtime: { normalHours, nightHours, holidayHours },
      }),
    [yearMonth, baseSalary, settings, rows, normalHours, nightHours, holidayHours],
  );

  const updateRow = (i: number, patch: Partial<AllowanceRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setError(null);
    if (priceMan == null || !Number.isFinite(priceMan) || priceMan < 0) {
      setError("単価を入力してください（万円）。");
      return;
    }
    for (const r of rows) {
      if (!r.name.trim()) {
        setError("手当名を入力してください。");
        return;
      }
      if (r.amount == null || !Number.isFinite(r.amount) || r.amount < 0) {
        setError("手当額を正しく入力してください（円）。");
        return;
      }
    }
    setSaving(true);
    try {
      await api.saveMonth(yearMonth, {
        unitPrice: manYenToYen(priceMan),
        overtime: { normalHours, nightHours, holidayHours },
        allowances: rows.map((r) => ({
          name: r.name.trim(),
          amount: r.amount ?? 0,
          includeInOvertimeBase: r.includeInOvertimeBase,
        })),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (isNew) {
      onRemoveDraft();
      return;
    }
    if (!confirm(`${yearMonth} の入力を削除しますか？`)) return;
    setError(null);
    setSaving(true);
    try {
      await api.deleteMonth(yearMonth);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const hasOptionalOt = nightHours > 0 || holidayHours > 0;

  return (
    <Card>
      <Card.Header className="flex flex-row items-start justify-between gap-4">
        <div>
          <Card.Title className="text-sm">{yearMonth}</Card.Title>
          {isNew && (
            <Card.Description className="text-xs text-warning">
              未保存（入力して保存してください）
            </Card.Description>
          )}
        </div>
        <div className="text-right">
          {income ? (
            <>
              <p className="text-muted text-xs">総支給見込み</p>
              <p className="text-xl font-bold">{formatYen(income.gross)} 円</p>
            </>
          ) : (
            <p className="text-muted text-xs">
              基本給は前四半期の単価が揃うと計算されます
            </p>
          )}
        </div>
      </Card.Header>

      <Card.Content className="space-y-4">
        {/* 単価 */}
        <div className="flex flex-wrap items-end gap-3">
          <NumberField
            value={priceMan ?? NaN}
            onChange={(v) => setPriceMan(Number.isNaN(v) ? null : v)}
            minValue={0}
            step={1}
            formatOptions={{ useGrouping: true, maximumFractionDigits: 4 }}
          >
            <Label>単価</Label>
            <NumberField.Group>
              <NumberField.Input placeholder="例: 85" />
              <span className="text-muted px-2 text-sm">万円</span>
            </NumberField.Group>
          </NumberField>
          <HoursField
            label="残業（通常）"
            value={normalHours}
            onChange={setNormalHours}
          />
        </div>

        {/* 深夜・休日（任意） */}
        <Disclosure defaultExpanded={hasOptionalOt}>
          <Disclosure.Heading>
            <Disclosure.Trigger>
              深夜・法定休日の残業（任意）
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

        {/* 手当 */}
        <div className="space-y-2">
          <p className="text-muted text-xs font-medium">手当</p>
          {rows.length === 0 && (
            <p className="text-muted text-xs">手当はありません。</p>
          )}
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <TextField
                value={r.name}
                onChange={(v) => updateRow(i, { name: v })}
                className="max-w-[12rem]"
              >
                <Label className="text-xs">手当名</Label>
                <Input placeholder="例: 職務手当 / 通勤手当" />
              </TextField>
              <NumberField
                value={r.amount ?? NaN}
                onChange={(v) =>
                  updateRow(i, { amount: Number.isNaN(v) ? null : v })
                }
                minValue={0}
                step={1000}
                formatOptions={{ useGrouping: true, maximumFractionDigits: 0 }}
              >
                <Label className="text-xs">金額</Label>
                <NumberField.Group>
                  <NumberField.Input placeholder="例: 20000" />
                  <span className="text-muted px-2 text-sm">円</span>
                </NumberField.Group>
              </NumberField>
              <Checkbox
                isSelected={r.includeInOvertimeBase}
                onChange={(v) => updateRow(i, { includeInOvertimeBase: v })}
                className="pb-2"
              >
                残業基礎
              </Checkbox>
              <Button
                variant="ghost"
                size="sm"
                className="pb-1"
                onPress={() =>
                  setRows((prev) => prev.filter((_, idx) => idx !== i))
                }
              >
                削除
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onPress={() =>
              setRows((prev) => [
                ...prev,
                { name: "", amount: null, includeInOvertimeBase: false },
              ])
            }
          >
            ＋ 手当を追加
          </Button>
        </div>

        {/* 内訳 */}
        {income && (
          <p className="text-muted bg-surface-secondary rounded-lg px-3 py-2 text-xs">
            基本給 {formatYen(income.baseSalary - income.overtime.deemedPay)}
            {" ＋ 固定残業代 "}
            {formatYen(income.overtime.deemedPay)}
            {income.allowanceTotal > 0 && (
              <> ＋ 手当 {formatYen(income.allowanceTotal)}</>
            )}
            {income.overtimePay > 0 && (
              <> ＋ 超過残業 {formatYen(income.overtimePay)}</>
            )}
            {" ＝ "}
            {formatYen(income.gross)} 円
          </p>
        )}

        {error && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            variant="primary"
            onPress={save}
            isDisabled={saving}
          >
            {saving ? "保存中…" : "保存"}
          </Button>
          <Button
            variant="danger-soft"
            onPress={remove}
            isDisabled={saving}
          >
            {isNew ? "取り消し" : "削除"}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
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
