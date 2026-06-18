import { useState, type FormEvent } from "react";
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
import { formatYen } from "@shared/calc";
import { currentYearMonth } from "@shared/periods";
import { api } from "../api";

/** 月単価の入力・編集（PRD §8 画面3）。過去月も遡って入力可能。 */
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
  const [price, setPrice] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (price == null || !Number.isFinite(price) || price <= 0) {
      setFormError("単価を正しく入力してください。");
      return;
    }
    setSaving(true);
    try {
      await api.savePrice(yearMonth, price);
      setPrice(null);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
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

  // 既存月をクリックしたら編集フォームへ反映
  const editExisting = (ym: string, p: number) => {
    setYearMonth(ym);
    setPrice(p);
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
            <NumberField
              value={price ?? NaN}
              onChange={(v) => setPrice(Number.isNaN(v) ? null : v)}
              minValue={0}
              isRequired
              formatOptions={{ useGrouping: true }}
            >
              <Label>月単価（円）</Label>
              <NumberField.Group>
                <NumberField.Input placeholder="例: 1000000" />
              </NumberField.Group>
            </NumberField>
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
            同じ年月を保存すると上書き更新されます。過去の月も遡って入力できます。
          </p>
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
                      <span className="text-muted ml-3">
                        {formatYen(p.unitPrice)} 円
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
