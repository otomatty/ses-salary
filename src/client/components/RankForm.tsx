import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Input,
  Label,
  NumberField,
  Radio,
  RadioGroup,
  TextField,
} from "@heroui/react";
import { averageUnitPrice, formatManYen, formatRate } from "@shared/calc";
import { currentYearMonth } from "@shared/periods";
import { findBand, type Rank, type RateBand } from "@shared/rateTable";
import { CONSULT_GUIDANCE, FIXED_GUIDANCE } from "@shared/guidance";
import type { MonthlyPriceDTO, UserSettingsDTO } from "@shared/types";
import { api } from "../api";

/**
 * 入力済みの月単価から「直近四半期の平均単価」を求め、該当する帯を判定する。
 * 新しい順に最大3ヶ月分を平均する（直前四半期の3ヶ月平均で給与が決まる仕様に合わせる）。
 * 単価が1件も無ければ null（帯を判定できない）。
 */
function deriveBand(prices: MonthlyPriceDTO[]): {
  band: RateBand;
  avg: number;
} | null {
  if (prices.length === 0) return null;
  const latest3 = [...prices]
    .sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1))
    .slice(0, 3);
  const avg = averageUnitPrice(latest3.map((p) => p.unitPrice));
  return { band: findBand(avg), avg };
}

/**
 * 評価ランクの設定フォーム（ランク選択＋適用開始月＋保存）。
 * 設定画面とオンボーディングの両方から使う共有コンポーネント
 * （フォームのドリフトを防ぐため `api.saveRank` 呼び出しと state をここに集約）。
 *
 * ランクの選択肢は、入力済み単価から判定した帯を冠して表示する（例: G 帯なら
 * 「G-1 / G-2 / G-3」）。帯の種別に応じて表示を切り替える:
 * - rank   … 帯付きランク（G-1/G-2/G-3）
 * - single … 単一レート（A-0/A-1）。ランク不問の旨を注記
 * - fixed  … 固定額（40万円未満）。ランク不問の旨を注記
 * - consult… 要相談（140万円以上）。手動で還元率(%)を入力できる
 *
 * 保存ボタン周りのレイアウトはページごとに異なるため、`footer` レンダープロップで
 * 保存ボタンを受け取り、各ページが他のボタン（戻る/スキップ等）と並べて配置できる。
 */
export function RankForm({
  initialRank,
  prices,
  settings,
  reload,
  onSaved,
  saveLabel = "保存",
  footer,
}: {
  initialRank: Rank;
  /** 帯判定に使う入力済みの月単価（= dashboard.prices）。 */
  prices: MonthlyPriceDTO[];
  /** consultRate の現在値の読み出し・他設定の echo 保存に使う（= dashboard.settings）。 */
  settings: UserSettingsDTO;
  reload: () => Promise<void>;
  /** 保存・再読込が成功したあとに呼ばれる（オンボーディングの次ステップ遷移などに使う）。 */
  onSaved?: () => void;
  saveLabel?: string;
  /** 保存ボタンを受け取り、他のアクションと並べて配置するためのスロット。 */
  footer?: (saveButton: ReactNode) => ReactNode;
}) {
  const [rank, setRank] = useState<Rank>(initialRank);
  const [effectiveFrom, setEffectiveFrom] = useState(currentYearMonth());
  const [consultRate, setConsultRate] = useState<number | null>(
    settings.consultRate,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const derived = useMemo(() => deriveBand(prices), [prices]);
  const band = derived?.band ?? null;
  const isConsult = band?.kind === "consult";

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveRank(rank, effectiveFrom);
      // M帯（要相談）の手動還元率は user_settings に保存する。
      // 他の設定項目は現在値をそのまま送って上書き消失を防ぐ。
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
    <Button variant="primary" onPress={save} isDisabled={saving}>
      {saving ? "保存中…" : saveLabel}
    </Button>
  );

  const rankLabel = (r: Rank) =>
    band?.kind === "rank" ? `${band.code}-${r}` : `ランク ${r}`;

  return (
    <div className="space-y-4">
      {derived && (
        <p className="text-muted text-xs">
          直近3ヶ月の平均単価{" "}
          <strong className="text-foreground">
            {formatManYen(derived.avg)}
          </strong>{" "}
          は <strong className="text-foreground">{band?.code}</strong>{" "}
          帯です。単価に応じて評価ランクの表記が決まります。
        </p>
      )}

      <RadioGroup
        value={String(rank)}
        onChange={(v) => setRank(Number(v) as Rank)}
        orientation="horizontal"
      >
        <Label>ランクを選択</Label>
        <div className="flex gap-4">
          {([1, 2, 3] as Rank[]).map((r) => (
            <Radio key={r} value={String(r)}>
              {rankLabel(r)}
            </Radio>
          ))}
        </div>
      </RadioGroup>

      {band == null && (
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

      <TextField
        value={effectiveFrom}
        onChange={setEffectiveFrom}
        className="max-w-xs"
      >
        <Label>適用開始月</Label>
        <Input type="month" />
        <p className="text-muted mt-1 text-xs">
          この月以降に適用される給与計算でこのランクが使われます。
        </p>
      </TextField>

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
