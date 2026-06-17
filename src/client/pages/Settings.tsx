import { useState } from "react";
import type { DashboardResponse } from "@shared/types";
import { currentYearMonth } from "@shared/periods";
import type { Rank } from "@shared/rateTable";
import { api } from "../api";
import {
  Button,
  Card,
  SectionTitle,
  Badge,
  ErrorBanner,
  NoticeBanner,
} from "../components/ui";

/** 設定画面（PRD §8 画面5）。評価ランクの選択。期ごとに履歴を保持。 */
export function Settings({
  dashboard,
  reload,
}: {
  dashboard: DashboardResponse;
  reload: () => Promise<void>;
}) {
  const [rank, setRank] = useState<Rank>(dashboard.currentRank);
  const [effectiveFrom, setEffectiveFrom] = useState(currentYearMonth());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveRank(rank, effectiveFrom);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const removeRank = async (id: string) => {
    if (!confirm("この評価ランク履歴を削除しますか？")) return;
    try {
      await api.deleteRank(id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  return (
    <div className="space-y-6">
      {dashboard.rankProvisional && (
        <NoticeBanner>
          評価ランクが未設定のため、暫定的にランク2で給与を計算しています。下記でランクを設定すると、暫定表示は消えます。
        </NoticeBanner>
      )}

      <Card>
        <SectionTitle>現在の評価ランク</SectionTitle>
        <div className="flex items-center gap-3">
          <Badge tone={dashboard.rankProvisional ? "amber" : "indigo"}>
            ランク {dashboard.currentRank}
            {dashboard.rankProvisional ? "（暫定）" : ""}
          </Badge>
          <span className="text-sm text-slate-500">
            {dashboard.rankProvisional
              ? "（未設定のため暫定値）"
              : `（${currentYearMonth()} 時点で適用中）`}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          評価ランクは人事評価で決まる枝番です。A-0 / A-1
          帯（40〜50万円）および固定額帯（40万円未満）ではランクに関わらず還元率が決まります。
        </p>
      </Card>

      <Card>
        <SectionTitle>評価ランクの変更</SectionTitle>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-slate-500">ランクを選択</p>
            <div className="flex gap-2">
              {([1, 2, 3] as Rank[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRank(r)}
                  className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                    rank === r
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  ランク {r}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col text-sm">
            <span className="mb-1 text-slate-500">適用開始月</span>
            <input
              type="month"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-48 rounded-lg border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 text-xs text-slate-400">
              この月以降に適用される給与計算でこのランクが使われます。
            </span>
          </label>

          {error && <ErrorBanner message={error} />}

          <Button onClick={save} disabled={saving}>
            {saving ? "保存中…" : "保存して再計算"}
          </Button>
        </div>
      </Card>

      {dashboard.rankHistory.length > 0 && (
        <Card>
          <SectionTitle>評価ランクの履歴</SectionTitle>
          <ul className="divide-y divide-slate-100">
            {[...dashboard.rankHistory]
              .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))
              .map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div>
                    <span className="font-medium text-slate-800">
                      {h.effectiveFrom} 〜
                    </span>
                    <span className="ml-3 text-slate-600">ランク {h.rank}</span>
                  </div>
                  <Button variant="danger" onClick={() => removeRank(h.id)}>
                    削除
                  </Button>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
