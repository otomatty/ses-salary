import { useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Label,
  NumberField,
  TextField,
} from "@heroui/react";
import type { DashboardResponse } from "@shared/types";
import { formatManYen, formatYen, manYenToYen, yenToManYen } from "@shared/calc";
import { compareYM, currentYearMonth, monthRange } from "@shared/periods";
import { api } from "../api";

/** 万円単位の単価入力フィールド。空欄は null として扱う。 */
function ManYenField({
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

/** 月単価の入力・編集（PRD §8 画面3）。過去月も遡って入力可能。単価は万円単位で入力する。 */
export function Prices({
  dashboard,
  reload,
  error,
}: {
  dashboard: DashboardResponse;
  reload: () => Promise<void>;
  error: string | null;
}) {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [priceMan, setPriceMan] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 一括入力（連続月に同じ単価を入れる）。
  const [bulkFrom, setBulkFrom] = useState(currentYearMonth());
  const [bulkTo, setBulkTo] = useState(currentYearMonth());
  const [bulkPriceMan, setBulkPriceMan] = useState<number | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const bulkMonths = useMemo(
    () => monthRange(bulkFrom, bulkTo),
    [bulkFrom, bulkTo],
  );

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

  const remove = async (id: string) => {
    if (!confirm("この月の単価を削除しますか？")) return;
    try {
      await api.deletePrice(id);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  // 既存月をクリックしたら編集フォームへ反映（円→万円に変換）
  const editExisting = (ym: string, yen: number) => {
    setYearMonth(ym);
    setPriceMan(yenToManYen(yen));
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
          <Card.Title className="text-sm">月単価の追加・編集</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-3">
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
        </Card.Content>
      </Card>

      {/* 一括入力（連続月に同じ単価をまとめて入れる） */}
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">一括入力（連続した月に同じ単価）</Card.Title>
          <Card.Description className="text-xs">
            単価が変わらない期間をまとめて入力できます（例: 4〜6月をすべて
            80万円）。
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-3">
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
              isDisabled={bulkSaving || bulkMonths.length === 0}
            >
              {bulkSaving ? "保存中…" : "一括保存"}
            </Button>
          </form>

          <p className="text-muted text-xs">
            {bulkMonths.length === 0 ? (
              "終了年月は開始年月以降にしてください。"
            ) : (
              <>
                <strong className="text-foreground">
                  {bulkMonths.length}ヶ月分
                </strong>
                （{bulkMonths[0]} 〜 {bulkMonths[bulkMonths.length - 1]}）を
                {bulkPriceMan != null && bulkPriceMan > 0 ? (
                  <>
                    {" "}
                    <strong className="text-foreground">
                      {bulkPriceMan}万円
                    </strong>{" "}
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
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title className="text-sm">
            登録済みの月単価（{dashboard.prices.length} 件）
          </Card.Title>
        </Card.Header>
        <Card.Content>
          {dashboard.prices.length === 0 ? (
            <p className="text-muted py-6 text-center text-sm">
              まだ登録がありません。上のフォームから入力してください。
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {[...dashboard.prices]
                .sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1))
                .map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div>
                      <span className="font-medium">{p.yearMonth}</span>
                      <span className="ml-3 font-medium">
                        {formatManYen(p.unitPrice)}
                      </span>
                      <span className="text-muted ml-2 text-xs">
                        （{formatYen(p.unitPrice)} 円）
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => editExisting(p.yearMonth, p.unitPrice)}
                      >
                        編集
                      </Button>
                      <Button
                        variant="danger-soft"
                        size="sm"
                        onPress={() => remove(p.id)}
                      >
                        削除
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
