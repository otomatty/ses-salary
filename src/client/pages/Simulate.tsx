import { useMemo, useState } from "react";
import { Button, Card, Chip, Radio, RadioGroup } from "@heroui/react";
import type { DashboardResponse } from "@shared/types";
import { formatManYen, formatYen, manYenToYen } from "@shared/calc";
import { CONSULT_DELTA_BLOCKED } from "@shared/guidance";
import {
  compareYM,
  computeSalaryForQuarter,
  computeSalaryForQuarterWithRank,
  currentYearMonth,
  nextQuarterStart,
  prevQuarterStart,
  quarterLabel,
  quarterMonths,
  quarterStartMonth,
  rankAt,
} from "@shared/periods";
import { diffSimulation } from "@shared/simulate";
import type { Rank } from "@shared/rateTable";
import { ManYenField } from "../components/ManYenField";
import { SalaryBreakdownCard } from "../components/SalaryBreakdownCard";
import { StatusGuidance } from "../components/StatusGuidance";
import { useNavigate } from "@tanstack/react-router";

/** 先まで選べる給与期の上限（最初の未来期から数えた四半期数）。 */
const MAX_FUTURE_QUARTERS = 12;

/**
 * 単価シミュレーション（PRD §5.2 Should）。
 *
 * 「未来の給与期（四半期）」を1つ選び、その給与を試算する。給与は直前四半期の
 * 平均単価で決まるため、直前四半期の月単価を入力対象にする。
 * 実績のある月は固定で反映し、未実績の月だけ仮単価を自由入力する。
 * ここでの入力は保存されず、DB には一切書き込まれない。
 */
export function Simulate({ dashboard }: { dashboard: DashboardResponse }) {
  const navigate = useNavigate();

  // 実績単価マップ（円）。固定で反映する。
  const actualPriceMap = useMemo(
    () => new Map(dashboard.prices.map((p) => [p.yearMonth, p.unitPrice])),
    [dashboard.prices],
  );

  // 選択可能な最小の給与期 = 今期の次（＝最初の未来期）。
  const minSalaryQuarter = useMemo(
    () => nextQuarterStart(quarterStartMonth(currentYearMonth())),
    [],
  );
  // 上限（あまりに先までは選ばせない）。
  const maxSalaryQuarter = useMemo(() => {
    let q = minSalaryQuarter;
    for (let i = 1; i < MAX_FUTURE_QUARTERS; i++) q = nextQuarterStart(q);
    return q;
  }, [minSalaryQuarter]);

  // 選択中の給与期（この期の給与を試算する）。既定は最初の未来期。
  const [salaryQuarter, setSalaryQuarter] = useState<string>(minSalaryQuarter);

  // この給与期の単価元になる「直前四半期」とその3ヶ月。
  const sourceQuarterStart = useMemo(
    () => prevQuarterStart(salaryQuarter),
    [salaryQuarter],
  );
  const sourceMonths = useMemo(
    () => quarterMonths(sourceQuarterStart),
    [sourceQuarterStart],
  );
  // 比較対象（実績だけで確定するこの期の給与）。直前期が実績で揃わなければ null。
  // 途中デビュー特例（デビュー月〜期末が実績で連続）も実績のみで確定する。
  const baseline = useMemo(
    () =>
      computeSalaryForQuarter(
        salaryQuarter,
        actualPriceMap,
        dashboard.rankHistory,
        dashboard.currentRank,
        dashboard.settings.consultRate,
      ),
    [
      salaryQuarter,
      actualPriceMap,
      dashboard.rankHistory,
      dashboard.currentRank,
      dashboard.settings.consultRate,
    ],
  );
  // 実績だけでデビュー特例が成立する期は、デビュー前の月を入力対象にしない。
  // （入力させると通常の3ヶ月計算になり、一律額のデビュー給与が出せなくなる）
  const isActualDebut = baseline?.breakdown.status === "debut";

  // 実績のない月＝仮単価を入力する対象（デビュー特例時は入力不要）。
  const editableMonths = useMemo(
    () =>
      isActualDebut ? [] : sourceMonths.filter((ym) => !actualPriceMap.has(ym)),
    [isActualDebut, sourceMonths, actualPriceMap],
  );
  const editableSet = useMemo(() => new Set(editableMonths), [editableMonths]);

  // 評価ランク（期ごとに選択可）。既定は履歴から推定し、ユーザー選択があれば優先。
  const defaultRank = useMemo(
    () => rankAt(dashboard.rankHistory, salaryQuarter, dashboard.currentRank),
    [dashboard.rankHistory, salaryQuarter, dashboard.currentRank],
  );
  const [rankOverride, setRankOverride] = useState<Rank | null>(null);
  const rank = rankOverride ?? defaultRank;

  // 仮単価の入力状態（月 → 万円）。月ごとに一意なので期を切り替えても保持する。
  const [hypoInputs, setHypoInputs] = useState<Record<string, number | null>>(
    {},
  );

  const valid = (v: number | null | undefined): v is number =>
    v != null && Number.isFinite(v) && v > 0;

  // すべての未実績月に有効な仮単価が入っているか。
  const allFilled = editableMonths.every((ym) => valid(hypoInputs[ym]));

  // 実績（固定）＋仮単価を合成した試算用の単価マップ。
  const calcPriceMap = useMemo(() => {
    const map = new Map(actualPriceMap);
    for (const ym of editableMonths) {
      const man = hypoInputs[ym];
      if (valid(man)) map.set(ym, manYenToYen(man));
    }
    return map;
  }, [actualPriceMap, editableMonths, hypoInputs]);

  const simulation = useMemo(
    () =>
      allFilled
        ? computeSalaryForQuarterWithRank(
            salaryQuarter,
            calcPriceMap,
            rank,
            dashboard.settings.consultRate,
          )
        : null,
    [allFilled, salaryQuarter, calcPriceMap, rank, dashboard.settings.consultRate],
  );

  const diff = useMemo(
    () =>
      simulation
        ? diffSimulation(baseline?.breakdown ?? null, simulation.breakdown)
        : null,
    [simulation, baseline],
  );

  const canGoPrev = compareYM(salaryQuarter, minSalaryQuarter) > 0;
  const canGoNext = compareYM(salaryQuarter, maxSalaryQuarter) < 0;

  return (
    <div className="space-y-6">
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">単価シミュレーション</Card.Title>
          <Card.Description className="text-xs">
            未来の給与期を選び、仮の単価で給与を試算します。ここでの入力は保存されず、DB
            には一切書き込まれません。
          </Card.Description>
        </Card.Header>
      </Card>

      {/* 給与期の選択 */}
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">試算する給与期</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              isDisabled={!canGoPrev}
              onPress={() =>
                setSalaryQuarter((q) => prevQuarterStart(q))
              }
              aria-label="前の期"
            >
              ← 前の期
            </Button>
            <div className="text-center">
              <p className="text-base font-semibold">
                {quarterLabel(salaryQuarter)}
              </p>
              <p className="text-muted text-xs">の給与</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              isDisabled={!canGoNext}
              onPress={() =>
                setSalaryQuarter((q) => nextQuarterStart(q))
              }
              aria-label="次の期"
            >
              次の期 →
            </Button>
          </div>
          <p className="text-muted text-xs">
            この期の給与は、直前の期{" "}
            <span className="font-medium">
              {quarterLabel(sourceQuarterStart)}
            </span>{" "}
            の平均単価で決まります。
          </p>
        </Card.Content>
      </Card>

      {/* 評価ランク（期ごとに選択可） */}
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">評価ランク</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-2">
          <RadioGroup
            value={String(rank)}
            onChange={(v) => setRankOverride(Number(v) as Rank)}
            orientation="horizontal"
            aria-label="評価ランク"
          >
            <div className="flex gap-4">
              {([1, 2, 3] as Rank[]).map((r) => (
                <Radio key={r} value={String(r)}>
                  ランク {r}
                  {r === defaultRank && (
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

      {/* 単価入力（直前期の3ヶ月） */}
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">単価の入力</Card.Title>
          <Card.Description className="text-xs">
            {quarterLabel(sourceQuarterStart)} の月単価
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="flex flex-wrap items-end gap-3">
            {sourceMonths.map((ym) => {
              const actual = actualPriceMap.get(ym);
              if (actual !== undefined) {
                // 実績月は固定表示（編集不可）。
                return (
                  <div
                    key={ym}
                    className="border-border bg-surface-secondary w-40 rounded-lg border px-3 py-2 text-sm"
                  >
                    <p className="text-muted text-xs">{ym}（実績）</p>
                    <p className="font-medium">{formatManYen(actual)}</p>
                  </div>
                );
              }
              if (!editableSet.has(ym)) {
                // デビュー前の月（実績なし・入力対象外）。デビュー特例では一律額になる。
                return (
                  <div
                    key={ym}
                    className="border-border w-40 rounded-lg border border-dashed px-3 py-2 text-sm"
                  >
                    <p className="text-muted text-xs">{ym}</p>
                    <p className="text-muted">対象外（デビュー前）</p>
                  </div>
                );
              }
              return (
                <ManYenField
                  key={ym}
                  label={`${ym}（仮単価）`}
                  value={hypoInputs[ym] ?? null}
                  onChange={(v) =>
                    setHypoInputs((prev) => ({ ...prev, [ym]: v }))
                  }
                />
              );
            })}
          </div>
          {editableMonths.length === 0 && (
            <p className="text-muted mt-3 text-xs">
              {isActualDebut
                ? "途中デビュー期のため、実績のみで一律額が適用されます。"
                : "この期は実績単価だけで確定しています。"}
            </p>
          )}
        </Card.Content>
      </Card>

      {/* 試算結果と差分 */}
      {!simulation ? (
        <Card>
          <Card.Content className="text-muted py-6 text-center text-sm">
            未実績月の仮単価を入力すると、帯・還元率・給与・計算式がリアルタイムに表示されます。
            {dashboard.prices.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onPress={() => navigate({ to: "/prices" })}
              >
                月単価を入力する →
              </Button>
            )}
          </Card.Content>
        </Card>
      ) : (
        <div className="space-y-4">
          {diff && (
            <DiffCard diff={diff} sim={simulation.breakdown} />
          )}
          <SalaryBreakdownCard title="試算結果" result={simulation} />
        </div>
      )}
    </div>
  );
}

/** 実績だけで確定する場合の給与と試算結果の差分（給与差額・帯・ランクの変化）を表示するカード。 */
function DiffCard({
  diff,
  sim,
}: {
  diff: import("@shared/simulate").SimulationDiff;
  sim: import("@shared/calc").SalaryBreakdown;
}) {
  if (!diff.baseline) {
    return (
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">実績との差分</Card.Title>
        </Card.Header>
        <Card.Content className="text-muted text-sm">
          この期は実績単価だけでは給与が確定していないため、比較対象がありません。仮単価のみで試算しています。
        </Card.Content>
      </Card>
    );
  }

  const b = diff.baseline;
  return (
    <Card className="ring-accent/40 ring-2">
      <Card.Header>
        <Card.Title className="text-sm">実績との差分</Card.Title>
        <Card.Description className="text-xs">
          実績単価だけで確定する給与との比較
        </Card.Description>
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
                実績のみ {formatYen(b.salary ?? 0)} 円 → 試算{" "}
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
