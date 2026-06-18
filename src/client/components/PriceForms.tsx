import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Alert,
  Button,
  Input,
  Label,
  NumberField,
  Tabs,
  TextField,
} from "@heroui/react";
import { manYenToYen, yenToManYen } from "@shared/calc";
import {
  BULK_MAX_MONTHS,
  compareYM,
  currentYearMonth,
  monthRange,
} from "@shared/periods";
import { api } from "../api";

/** 万円単位の単価入力フィールド。空欄は null として扱う。 */
export function ManYenField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <NumberField
      value={value ?? NaN}
      onChange={(v) => onChange(Number.isNaN(v) ? null : v)}
      minValue={0}
      step={1}
      isRequired
      formatOptions={{ useGrouping: true, maximumFractionDigits: 4 }}
    >
      <Label>{label}</Label>
      <NumberField.Group>
        <NumberField.Input placeholder={placeholder ?? "例: 80"} />
        <span className="text-muted px-2 text-sm">万円</span>
      </NumberField.Group>
    </NumberField>
  );
}

/** 親から単発入力フォームへ編集対象を流し込むための命令ハンドル。 */
export interface SinglePriceFormHandle {
  /** 既存月（円単位の単価）を編集フォームへ反映する。 */
  setEdit: (yearMonth: string, unitPriceYen: number) => void;
}

/** 単発入力フォーム（1ヶ月分の単価を追加・編集）。 */
export const SinglePriceForm = forwardRef<
  SinglePriceFormHandle,
  { reload: () => Promise<void> }
>(function SinglePriceForm({ reload }, ref) {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [priceMan, setPriceMan] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useImperativeHandle(ref, () => ({
    setEdit: (ym: string, yen: number) => {
      setYearMonth(ym);
      setPriceMan(yenToManYen(yen));
      setFormError(null);
    },
  }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (priceMan == null || !Number.isFinite(priceMan) || priceMan <= 0) {
      setFormError("単価を正しく入力してください（万円単位）。");
      return;
    }
    setSaving(true);
    try {
      await api.savePrice(yearMonth, manYenToYen(priceMan));
      setPriceMan(null);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <TextField value={yearMonth} onChange={setYearMonth} isRequired>
          <Label>年月</Label>
          <Input type="month" />
        </TextField>
        <ManYenField
          label="月単価（万円）"
          value={priceMan}
          onChange={setPriceMan}
        />
        <Button type="submit" variant="primary" isDisabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
      </form>
      {formError && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{formError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <p className="text-muted text-xs">
        単価は<strong>万円単位</strong>で入力します（例: 80 →
        80万円）。同じ年月を保存すると上書き更新されます。過去の月も遡って入力できます。
      </p>
    </div>
  );
});

/** 一括入力フォーム（連続した月に同じ単価をまとめて入れる）。 */
export function BulkPriceForm({ reload }: { reload: () => Promise<void> }) {
  const [bulkFrom, setBulkFrom] = useState(currentYearMonth());
  const [bulkTo, setBulkTo] = useState(currentYearMonth());
  const [bulkPriceMan, setBulkPriceMan] = useState<number | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const bulkMonths = useMemo(
    () => monthRange(bulkFrom, bulkTo),
    [bulkFrom, bulkTo],
  );
  const bulkOverLimit = bulkMonths.length > BULK_MAX_MONTHS;

  const submitBulk = async (e: FormEvent) => {
    e.preventDefault();
    setBulkError(null);
    if (compareYM(bulkFrom, bulkTo) > 0) {
      setBulkError("終了年月は開始年月以降にしてください。");
      return;
    }
    if (bulkMonths.length === 0) {
      setBulkError("対象の月がありません。");
      return;
    }
    if (bulkMonths.length > BULK_MAX_MONTHS) {
      setBulkError(
        `一度に入力できるのは${BULK_MAX_MONTHS}ヶ月までです（現在 ${bulkMonths.length}ヶ月分が選択されています）。期間を分けて入力してください。`,
      );
      return;
    }
    if (
      bulkPriceMan == null ||
      !Number.isFinite(bulkPriceMan) ||
      bulkPriceMan <= 0
    ) {
      setBulkError("単価を正しく入力してください（万円単位）。");
      return;
    }
    setBulkSaving(true);
    try {
      const unitPrice = manYenToYen(bulkPriceMan);
      await api.savePricesBulk(
        bulkMonths.map((ym) => ({ yearMonth: ym, unitPrice })),
      );
      setBulkPriceMan(null);
      await reload();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "一括保存に失敗しました");
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-muted text-xs">
        単価が変わらない期間をまとめて入力できます（例: 4〜6月をすべて
        80万円）。
      </p>
      <form onSubmit={submitBulk} className="flex flex-wrap items-end gap-3">
        <TextField value={bulkFrom} onChange={setBulkFrom} isRequired>
          <Label>開始年月</Label>
          <Input type="month" />
        </TextField>
        <TextField value={bulkTo} onChange={setBulkTo} isRequired>
          <Label>終了年月</Label>
          <Input type="month" />
        </TextField>
        <ManYenField
          label="単価（万円）"
          value={bulkPriceMan}
          onChange={setBulkPriceMan}
        />
        <Button
          type="submit"
          variant="primary"
          isDisabled={bulkSaving || bulkMonths.length === 0 || bulkOverLimit}
        >
          {bulkSaving ? "保存中…" : "一括保存"}
        </Button>
      </form>

      <p className="text-muted text-xs">
        {bulkMonths.length === 0 ? (
          "終了年月は開始年月以降にしてください。"
        ) : bulkOverLimit ? (
          <span className="text-danger">
            {bulkMonths.length}ヶ月分が選択されています。一度に入力できるのは
            {BULK_MAX_MONTHS}ヶ月までです。期間を分けて入力してください。
          </span>
        ) : (
          <>
            <strong className="text-foreground">
              {bulkMonths.length}ヶ月分
            </strong>
            （{bulkMonths[0]} 〜 {bulkMonths[bulkMonths.length - 1]}）を
            {bulkPriceMan != null && bulkPriceMan > 0 ? (
              <>
                {" "}
                <strong className="text-foreground">{bulkPriceMan}万円</strong>{" "}
                で保存します。
              </>
            ) : (
              " 保存します（単価を入力してください）。"
            )}
            既存の月は上書きされます。
          </>
        )}
      </p>
      {bulkError && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{bulkError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </div>
  );
}

/**
 * 単発入力・一括入力をタブで切り替える単価入力 UI。
 * forwardRef で {@link SinglePriceFormHandle} を公開し、外部から「単発入力タブへ
 * 切り替えて編集対象を流し込む」操作（既存月の編集）に対応する。
 */
export const PriceInputTabs = forwardRef<
  SinglePriceFormHandle,
  { reload: () => Promise<void> }
>(function PriceInputTabs({ reload }, ref) {
  const [tab, setTab] = useState<string>("single");
  const singleRef = useRef<SinglePriceFormHandle>(null);

  useImperativeHandle(ref, () => ({
    setEdit: (ym: string, yen: number) => {
      setTab("single");
      singleRef.current?.setEdit(ym, yen);
    },
  }));

  return (
    <Tabs
      selectedKey={tab}
      onSelectionChange={(key) => setTab(String(key))}
    >
      <Tabs.List aria-label="単価の入力方法">
        <Tabs.Tab id="single">単発入力</Tabs.Tab>
        <Tabs.Tab id="bulk">一括入力</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="single" className="pt-4">
        <SinglePriceForm ref={singleRef} reload={reload} />
      </Tabs.Panel>
      <Tabs.Panel id="bulk" className="pt-4">
        <BulkPriceForm reload={reload} />
      </Tabs.Panel>
    </Tabs>
  );
});
