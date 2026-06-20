import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Button, Label, NumberField } from "@heroui/react";
import { bandAtMonth } from "@shared/bandAtMonth";
import { averageUnitPrice, formatRate } from "@shared/calc";
import { CONSULT_GUIDANCE, FIXED_GUIDANCE } from "@shared/guidance";
import { currentYearMonth, quarterStartMonth } from "@shared/periods";
import { findBand, type Rank, type RateBand } from "@shared/rateTable";
import type { MonthlyPriceDTO, RankHistoryDTO, UserSettingsDTO } from "@shared/types";
import { api } from "../api";
import { normalizeRankDraft } from "../lib/rankStrip";
import { RankYearEditor } from "./RankYearEditor";

/**
 * 入力済みの月単価から「直近四半期の平均単価」を求め、該当する帯を判定する。
 * 新しい順に最大3ヶ月分を平均する（直前四半期の3ヶ月平均で給与が決まる仕様に合わせる）。
 * 単価が1件も無ければ null（帯を判定できない）。
 */
function deriveBand(pricePoints: { yearMonth: string; unitPrice: number }[]): {
  band: RateBand;
  avg: number;
} | null {
  if (pricePoints.length === 0) return null;
  const latest3 = [...pricePoints]
    .sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1))
    .slice(0, 3);
  const avg = averageUnitPrice(latest3.map((p) => p.unitPrice));
  return { band: findBand(avg), avg };
}

/**
 * 評価ランクの設定フォーム（12ヶ月ストリップ＋保存）。
 * 設定画面とオンボーディングの両方から使う共有コンポーネント
 * （フォームのドリフトを防ぐため `api.saveRank` 呼び出しと state をここに集約）。
 */
export function RankForm({
  prices,
  priceMap: priceMapOverride,
  rankHistory,
  settings,
  reload,
  onSaved,
  saveLabel = "保存",
  footer,
  /** true のとき変更がなくても保存ボタンを有効にし、押下で次へ進める（オンボーディング用）。 */
  advanceWithoutChanges = false,
}: {
  prices: MonthlyPriceDTO[];
  /** 指定時は {@link prices} より優先（オンボーディングの step1 下書き引き継ぎ等）。 */
  priceMap?: Map<string, number>;
  rankHistory: RankHistoryDTO[];
  settings: UserSettingsDTO;
  reload: () => Promise<void>;
  onSaved?: () => void;
  saveLabel?: string;
  footer?: (saveButton: ReactNode) => ReactNode;
  advanceWithoutChanges?: boolean;
}) {
  const [rankDraft, setRankDraft] = useState(() =>
    normalizeRankDraft(rankHistory),
  );
  const [consultRate, setConsultRate] = useState<number | null>(
    settings.consultRate,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRankDraft(normalizeRankDraft(rankHistory));
  }, [rankHistory]);

  const priceMap = useMemo(() => {
    if (priceMapOverride) return priceMapOverride;
    return new Map(prices.map((p) => [p.yearMonth, p.unitPrice]));
  }, [priceMapOverride, prices]);

  const pricesForBand = useMemo(
    () =>
      [...priceMap.entries()].map(([yearMonth, unitPrice]) => ({
        yearMonth,
        unitPrice,
      })),
    [priceMap],
  );

  const serverDraft = useMemo(
    () => normalizeRankDraft(rankHistory),
    [rankHistory],
  );

  const derived = useMemo(() => deriveBand(pricesForBand), [pricesForBand]);
  const band = derived?.band ?? null;
  const isConsult = band?.kind === "consult";

  const hasDraftChanges = useMemo(() => {
    if (rankDraft.size !== serverDraft.size) return true;
    for (const [ym, rank] of rankDraft) {
      if (serverDraft.get(ym) !== rank) return true;
    }
    return false;
  }, [rankDraft, serverDraft]);

  const hasConsultChanges =
    isConsult && consultRate !== settings.consultRate;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const toUpsert: { effectiveFrom: string; rank: Rank }[] = [];
      for (const [ym, rank] of rankDraft) {
        if (serverDraft.get(ym) !== rank) {
          toUpsert.push({ effectiveFrom: ym, rank });
        }
      }
      const toDelete = rankHistory.filter(
        (h) => !rankDraft.has(quarterStartMonth(h.effectiveFrom)),
      );

      if (
        toUpsert.length === 0 &&
        toDelete.length === 0 &&
        !hasConsultChanges
      ) {
        onSaved?.();
        return;
      }

      for (const { effectiveFrom, rank } of toUpsert) {
        await api.saveRank(rank, effectiveFrom);
      }
      await Promise.all(toDelete.map((h) => api.deleteRank(h.id)));

      if (isConsult) {
        await api.saveSettings({
          employmentType: settings.employmentType,
          monthlyStandardHours: settings.monthlyStandardHours,
          deemedOvertimeHours: settings.deemedOvertimeHours,
          consultRate: consultRate ?? null,
        });
      }
      await reload();
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <Button
      variant="primary"
      onPress={save}
      isDisabled={
        saving ||
        (!advanceWithoutChanges && !hasDraftChanges && !hasConsultChanges)
      }
    >
      {saving ? "保存中…" : saveLabel}
    </Button>
  );

  const currentMonthBand = bandAtMonth(currentYearMonth(), priceMap);

  return (
    <div className="space-y-4">
      <RankYearEditor
        value={rankDraft}
        onChange={setRankDraft}
        priceMap={priceMap}
        consultRate={isConsult ? consultRate : null}
      />

      {derived && (
        <p className="text-muted text-xs">
          評価ランクは<strong className="text-foreground">四半期ごと</strong>
          に設定し、直前四半期の平均単価 × 還元率で
          <strong className="text-foreground">次の四半期</strong>
          の基本給（総支給）が決まります。ストリップには算出された基本給を表示しています。
        </p>
      )}

      {currentMonthBand == null && pricesForBand.length > 0 && (
        <p className="text-muted text-xs">
          当月の帯を判定するには、直前四半期の3ヶ月分の単価が必要です。
        </p>
      )}

      {band == null && pricesForBand.length === 0 && (
        <p className="text-muted text-xs">
          先に月単価を入力すると、単価に応じた評価ランク（例: G-1 / G-2 /
          G-3）が表示されます。
        </p>
      )}

      {band?.kind === "single" && (
        <p className="text-muted text-xs">
          {band.code} 帯は枝番なしの単一レートのため、評価ランクに関わらず{" "}
          {band.rate != null ? formatRate(band.rate) : ""}{" "}
          が適用されます（ランクは将来の単価変動に備えて保存されます）。
        </p>
      )}

      {band?.kind === "fixed" && (
        <p className="text-muted text-xs">
          {FIXED_GUIDANCE.reason}{" "}
          評価ランクに関わらず適用されます（ランクは将来の単価変動に備えて保存されます）。
        </p>
      )}

      {isConsult && (
        <div className="space-y-2">
          <NumberField
            value={consultRate ?? NaN}
            onChange={(v) => setConsultRate(Number.isNaN(v) ? null : v)}
            minValue={0}
            maxValue={100}
            step={0.01}
            className="max-w-xs"
            formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
          >
            <Label>還元率（%）</Label>
            <NumberField.Group>
              <NumberField.Input placeholder="例: 56.34" />
              <span className="text-muted px-2 text-sm">%</span>
            </NumberField.Group>
          </NumberField>
          <p className="text-muted text-xs">
            {CONSULT_GUIDANCE.reason}{" "}
            このアプリでは、会社と合意した還元率を入力すると「率 ×
            平均単価」で給与を自動計算します。空欄のままなら要相談（自動計算外）として扱います。
          </p>
        </div>
      )}

      {error && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {footer ? footer(saveButton) : saveButton}
    </div>
  );
}
