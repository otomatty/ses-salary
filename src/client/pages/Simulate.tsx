import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Chip,
  Label,
  NumberField,
  Radio,
  RadioGroup,
  Tabs,
} from "@heroui/react";
import type { DashboardResponse } from "@shared/types";
import type { PricePoint } from "@shared/calc";
import { formatManYen, formatYen, manYenToYen, yenToManYen } from "@shared/calc";
import { CONSULT_DELTA_BLOCKED } from "@shared/guidance";
import { addMonths, currentYearMonth, precedingMonths } from "@shared/periods";
import {
  buildSimulation,
  diffSimulation,
  latestTwoMonths,
} from "@shared/simulate";
import type { Rank } from "@shared/rateTable";
import { SalaryBreakdownCard } from "../components/SalaryBreakdownCard";
import { StatusGuidance } from "../components/StatusGuidance";
import { navigate } from "../router";

type Mode = "recent2" | "all3";

/** 仮単価入力用の NumberField（万円単位）。空欄は null として扱う。 */
function PriceField({
  label,
  value,
  onChange,
}: {
  label: string;
  /** 万円単位の値 */
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <NumberField
      value={value ?? NaN}
      onChange={(v) => onChange(Number.isNaN(v) ? null : v)}
      minValue={0}
      step={1}
      formatOptions={{ useGrouping: true, maximumFractionDigits: 4 }}
    >
      <Label>{label}</Label>
      <NumberField.Group>
        <NumberField.Input placeholder="例: 80" />
        <span className="text-muted px-2 text-sm">万円</span>
      </NumberField.Group>
    </NumberField>
  );
}

/**
 * 単価シミュレーション（PRD §5.2 Should）。
 * 仮単価から給与を即時試算する。DB には一切書き込まない。
 */
export function Simulate({ dashboard }: { dashboard: DashboardResponse }) {
  const [mode, setMode] = useState<Mode>("recent2");
  const [rank, setRank] = useState<Rank>(dashboard.currentRank);

  // 比較対象（現在の予測）: 来期予測を優先し、無ければ今期。
  const baselineResult = dashboard.next ?? dashboard.current;

  // 「直近2ヶ月＋仮単価1ヶ月」用の実績。
  const recentTwo = useMemo(
    () => latestTwoMonths(dashboard.prices),
    [dashboard.prices],
  );
  const hypoMonth =
    recentTwo.length === 2
      ? addMonths(recentTwo[1].yearMonth, 1)
      : addMonths(currentYearMonth(), 1);

  // 「3ヶ月すべて仮入力」用の対象月ラベル（最新実績、無ければ当月を起点）。
  const anchor =
    dashboard.prices.length > 0
      ? [...dashboard.prices].sort((a, b) =>
          a.yearMonth < b.yearMonth ? 1 : -1,
        )[0].yearMonth
      : currentYearMonth();
  const all3Months = useMemo(
    () => precedingMonths(addMonths(anchor, 1), 3),
    [anchor],
  );

  // 入力状態。初期値は実績があれば流用（仮入力の出発点）。
  const priceMap = useMemo(
    () => new Map(dashboard.prices.map((p) => [p.yearMonth, p.unitPrice])),
    [dashboard.prices],
  );
  // 仮単価の入力状態はすべて「万円単位」で保持する（実績は円で保持）。
  const toMan = (yen: number | undefined): number | null =>
    yen != null ? yenToManYen(yen) : null;
  const [hypoPrice, setHypoPrice] = useState<number | null>(null);
  const [all3Prices, setAll3Prices] = useState<[
    number | null,
    number | null,
    number | null,
  ]>(() => [
    toMan(priceMap.get(all3Months[0])),
    toMan(priceMap.get(all3Months[1])),
    toMan(priceMap.get(all3Months[2])),
  ]);

  // 入力（万円）から対象3ヶ月の単価点（円）を組み立てる（不正・未入力なら null）。
  const months = useMemo<PricePoint[] | null>(() => {
    const valid = (v: number | null): v is number =>
      v != null && Number.isFinite(v) && v > 0;
    if (mode === "recent2") {
      if (recentTwo.length < 2) return null;
      if (!valid(hypoPrice)) return null;
      return [
        ...recentTwo,
        { yearMonth: hypoMonth, unitPrice: manYenToYen(hypoPrice) },
      ];
    }
    if (!all3Prices.every(valid)) return null;
    return all3Months.map((ym, i) => ({
      yearMonth: ym,
      unitPrice: manYenToYen(all3Prices[i] as number),
    }));
  }, [mode, recentTwo, hypoPrice, hypoMonth, all3Prices, all3Months]);

  const simulation = useMemo(
    () => (months ? buildSimulation(months, rank) : null),
    [months, rank],
  );
  const diff = useMemo(
    () =>
      simulation
        ? diffSimulation(
            baselineResult?.breakdown ?? null,
            simulation.breakdown,
          )
        : null,
    [simulation, baselineResult],
  );

  return (
    <div className="space-y-6">
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">単価シミュレーション</Card.Title>
          <Card.Description className="text-xs">
            仮の単価を入力して給与を試算します。ここでの入力は保存されず、DB
            には一切書き込まれません。
          </Card.Description>
        </Card.Header>
      </Card>

      {/* モード選択 */}
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">入力モード</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-2">
          <Tabs
            selectedKey={mode}
            onSelectionChange={(k) => setMode(k as Mode)}
          >
            <Tabs.List>
              <Tabs.Tab id="recent2">
                直近2ヶ月＋仮単価1ヶ月
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="all3">
                3ヶ月すべて仮入力
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <p className="text-muted text-xs">
            {mode === "recent2"
              ? "実績の直近2ヶ月に、仮の翌月単価を加えて試算します。"
              : "対象3ヶ月の単価をすべて自由に入力して試算します。"}
          </p>
        </Card.Content>
      </Card>

      {/* 評価ランク（現在値をデフォルト、変更可） */}
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">評価ランク</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-2">
          <RadioGroup
            value={String(rank)}
            onChange={(v) => setRank(Number(v) as Rank)}
            orientation="horizontal"
            aria-label="評価ランク"
          >
            <div className="flex gap-4">
              {([1, 2, 3] as Rank[]).map((r) => (
                <Radio key={r} value={String(r)}>
                  ランク {r}
                  {r === dashboard.currentRank && (
                    <span className="text-muted ml-1 text-xs">（現在）</span>
                  )}
                </Radio>
              ))}
            </div>
          </RadioGroup>
          <p className="text-muted text-xs">
            A-0 / A-1 帯および固定額帯では、ランクに関わらず還元率が決まります。
          </p>
        </Card.Content>
      </Card>

      {/* 単価入力 */}
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">仮単価の入力</Card.Title>
        </Card.Header>
        <Card.Content>
          {mode === "recent2" ? (
            recentTwo.length < 2 ? (
              <div className="text-muted py-4 text-center text-sm">
                <p>このモードには直近2ヶ月の実績単価が必要です。</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onPress={() => navigate("prices")}
                >
                  月単価を入力する →
                </Button>
                <p className="mt-2 text-xs">
                  「3ヶ月すべて仮入力」モードなら実績なしでも試算できます。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {recentTwo.map((m) => (
                    <div
                      key={m.yearMonth}
                      className="border-border bg-surface-secondary rounded-lg border px-3 py-2 text-sm"
                    >
                      <p className="text-muted text-xs">
                        {m.yearMonth}（実績）
                      </p>
                      <p className="font-medium">{formatManYen(m.unitPrice)}</p>
                    </div>
                  ))}
                </div>
                <PriceField
                  label={`${hypoMonth}（仮単価）`}
                  value={hypoPrice}
                  onChange={setHypoPrice}
                />
              </div>
            )
          ) : (
            <div className="flex flex-wrap gap-3">
              {all3Months.map((ym, i) => (
                <PriceField
                  key={ym}
                  label={`${ym}（仮単価）`}
                  value={all3Prices[i]}
                  onChange={(v) =>
                    setAll3Prices((prev) => {
                      const next = [...prev] as [
                        number | null,
                        number | null,
                        number | null,
                      ];
                      next[i] = v;
                      return next;
                    })
                  }
                />
              ))}
            </div>
          )}
        </Card.Content>
      </Card>

      {/* 試算結果と差分 */}
      {!simulation ? (
        <Card>
          <Card.Content className="text-muted py-6 text-center text-sm">
            仮単価を入力すると、帯・還元率・給与・計算式がリアルタイムに表示されます。
          </Card.Content>
        </Card>
      ) : (
        <div className="space-y-4">
          {diff && (
            <DiffCard
              diff={diff}
              baseline={baselineResult}
              sim={simulation.breakdown}
            />
          )}
          <SalaryBreakdownCard title="試算結果" result={simulation} />
        </div>
      )}
    </div>
  );
}

/** 現在の予測と試算結果の差分（給与差額・帯・ランクの変化）を表示するカード。 */
function DiffCard({
  diff,
  baseline,
  sim,
}: {
  diff: import("@shared/simulate").SimulationDiff;
  baseline: import("@shared/periods").SalaryResult | null;
  sim: import("@shared/calc").SalaryBreakdown;
}) {
  if (!diff.baseline || !baseline) {
    return (
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">現在の予測との差分</Card.Title>
        </Card.Header>
        <Card.Content className="text-muted text-sm">
          比較対象となる現在の予測がまだありません。直近3ヶ月の単価を入力すると差分を表示できます。
        </Card.Content>
      </Card>
    );
  }

  const b = diff.baseline;
  return (
    <Card className="ring-accent/40 ring-2">
      <Card.Header>
        <Card.Title className="text-sm">現在の予測との差分</Card.Title>
      </Card.Header>
      <Card.Content>
        {/* 給与差額 */}
        <div className="mb-4">
          {diff.salaryDelta === null ? (
            <div className="space-y-3">
              <p className="text-warning text-sm">{CONSULT_DELTA_BLOCKED}</p>
              {(b.status === "consult" || sim.status === "consult") && (
                <StatusGuidance status="consult" compact />
              )}
            </div>
          ) : (
            <div>
              <p
                className={`text-3xl font-bold ${
                  diff.salaryDelta > 0
                    ? "text-success"
                    : diff.salaryDelta < 0
                      ? "text-danger"
                      : "text-foreground"
                }`}
              >
                {diff.salaryDelta > 0 ? "+" : ""}
                {formatYen(diff.salaryDelta)}
                <span className="text-muted ml-1 text-base font-normal">
                  円 / 月
                </span>
              </p>
              <p className="text-muted mt-1 text-xs">
                現在の予測 {formatYen(b.salary ?? 0)} 円 → 試算{" "}
                {formatYen(sim.salary ?? 0)} 円
              </p>
            </div>
          )}
        </div>

        {/* 帯・ランクの変化 */}
        <dl className="space-y-2 text-sm">
          <div className="border-border flex items-center justify-between border-b pb-2">
            <dt className="text-muted">帯</dt>
            <dd className="flex items-center gap-2 font-medium">
              <span>{b.band.code}</span>
              {diff.bandChanged ? (
                <>
                  <span className="text-muted">→</span>
                  <Chip color="accent" variant="soft" size="sm">
                    {sim.band.code}
                  </Chip>
                </>
              ) : (
                <span className="text-muted text-xs">（変化なし）</span>
              )}
            </dd>
          </div>
          <div className="border-border flex items-center justify-between border-b pb-2">
            <dt className="text-muted">評価ランク</dt>
            <dd className="flex items-center gap-2 font-medium">
              <span>ランク {b.rank}</span>
              {diff.rankChanged ? (
                <>
                  <span className="text-muted">→</span>
                  <Chip color="accent" variant="soft" size="sm">
                    ランク {sim.rank}
                  </Chip>
                </>
              ) : (
                <span className="text-muted text-xs">（変化なし）</span>
              )}
            </dd>
          </div>
        </dl>
      </Card.Content>
    </Card>
  );
}
