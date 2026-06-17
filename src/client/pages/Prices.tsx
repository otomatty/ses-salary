import { useState, type FormEvent } from "react";
import type { DashboardResponse } from "@shared/types";
import { formatYen } from "@shared/calc";
import { currentYearMonth } from "@shared/periods";
import { api } from "../api";
import {
  Button,
  Card,
  SectionTitle,
  ErrorBanner,
} from "../components/ui";

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
  const [price, setPrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("単価を正しく入力してください。");
      return;
    }
    setSaving(true);
    try {
      await api.savePrice(yearMonth, value);
      setPrice("");
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
    setPrice(String(p));
  };

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      <Card>
        <SectionTitle>月単価の追加・編集</SectionTitle>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-slate-500">年月</span>
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-slate-500">月単価（円）</span>
            <input
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="例: 1000000"
              className="w-40 rounded-lg border border-slate-300 px-3 py-2"
              min={0}
              required
            />
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </form>
        {formError && (
          <div className="mt-3">
            <ErrorBanner message={formError} />
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          同じ年月を保存すると上書き更新されます。過去の月も遡って入力できます。
        </p>
      </Card>

      <Card>
        <SectionTitle>登録済みの月単価（{dashboard.prices.length} 件）</SectionTitle>
        {dashboard.prices.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            まだ登録がありません。上のフォームから入力してください。
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...dashboard.prices]
              .sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1))
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <div>
                    <span className="font-medium text-slate-800">
                      {p.yearMonth}
                    </span>
                    <span className="ml-3 text-slate-600">
                      {formatYen(p.unitPrice)} 円
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => editExisting(p.yearMonth, p.unitPrice)}
                    >
                      編集
                    </Button>
                    <Button variant="danger" onClick={() => remove(p.id)}>
                      削除
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
