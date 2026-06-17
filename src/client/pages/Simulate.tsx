import { useMemo, useState } from "react";
import type { DashboardResponse } from "@shared/types";
import type { PricePoint } from "@shared/calc";
import { formatYen } from "@shared/calc";
import { CONSULT_DELTA_BLOCKED } from "@shared/guidance";
import { addMonths, currentYearMonth, precedingMonths } from "@shared/periods";
import {
  buildSimulation,
  diffSimulation,
  latestTwoMonths,
} from "@shared/simulate";
import type { Rank } from "@shared/rateTable";
import { Badge, Card, SectionTitle } from "../components/ui";
import { SalaryBreakdownCard } from "../components/SalaryBreakdownCard";
import { StatusGuidance } from "../components/StatusGuidance";
import { navigate } from "../router";

type Mode = "recent2" | "all3";

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
  const [hypoPrice, setHypoPrice] = useState("");
  const [all3Prices, setAll3Prices] = useState<[string, string, string]>(() => [
    String(priceMap.get(all3Months[0]) ?? ""),
    String(priceMap.get(all3Months[1]) ?? ""),
    String(priceMap.get(all3Months[2]) ?? ""),
  ]);

  // 入力から対象3ヶ月の単価点を組み立てる（不正・未入力なら null）。
  const months = useMemo<PricePoint[] | null>(() => {
    if (mode === "recent2") {
      if (recentTwo.length < 2) return null;
      const v = Number(hypoPrice);
      if (!Number.isFinite(v) || v <= 0) return null;
      return [...recentTwo, { yearMonth: hypoMonth, unitPrice: v }];
    }
    const values = all3Prices.map((p) => Number(p));
    if (values.some((v) => !Number.isFinite(v) || v <= 0)) return null;
    return all3Months.map((ym, i) => ({ yearMonth: ym, unitPrice: values[i] }));
  }, [mode, recentTwo, hypoPrice, hypoMonth, all3Prices, all3Months]);

  const simulation = useMemo(
    () => (months ? buildSimulation(months, rank) : null),
    [months, rank],
  );
  const diff = useMemo(
    () =>
      simulation
        ? diffSimulation(baselineResult?.breakdown ?? null, simulation.breakdown)
        : null,
    [simulation, baselineResult],
  );

  const ranks: Rank[] = [1, 2, 3];

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>単価シミュレーション</SectionTitle>
        <p className="text-xs text-slate-400">
          仮の単価を入力して給与を試算します。ここでの入力は保存されず、DB
          には一切書き込まれません。
        </p>
      </Card>

      {/* モード選択 */}
      <Card>
        <SectionTitle>入力モード</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          <ModeButton
            active={mode === "recent2"}
            title="直近2ヶ月＋仮単価1ヶ月"
            desc="実績の直近2ヶ月に、仮の翌月単価を加えて試算"
            onClick={() => setMode("recent2")}
          />
          <ModeButton
            active={mode === "all3"}
            title="3ヶ月すべて仮入力"
            desc="対象3ヶ月の単価をすべて自由に入力して試算"
            onClick={() => setMode("all3")}
          />
        </div>
      </Card>

      {/* 評価ランク（現在値をデフォルト、変更可） */}
      <Card>
        <SectionTitle>評価ランク</SectionTitle>
        <div className="flex gap-2">
          {ranks.map((r) => (
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
              {r === dashboard.currentRank && (
                <span className="ml-1 text-xs text-slate-400">（現在）</span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          A-0 / A-1 帯および固定額帯では、ランクに関わらず還元率が決まります。
        </p>
      </Card>

      {/* 単価入力 */}
      <Card>
        <SectionTitle>仮単価の入力</SectionTitle>
        {mode === "recent2" ? (
          recentTwo.length < 2 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              このモードには直近2ヶ月の実績単価が必要です。
              <br />
              <button
                onClick={() => navigate("prices")}
                className="mt-2 text-indigo-600 hover:underline"
              >
                月単価を入力する →
              </button>
              <br />
              <span className="mt-2 inline-block text-xs">
                「3ヶ月すべて仮入力」モードなら実績なしでも試算できます。
              </span>
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {recentTwo.map((m) => (
                  <div
                    key={m.yearMonth}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <p className="text-xs text-slate-400">{m.yearMonth}（実績）</p>
                    <p className="font-medium text-slate-700">
                      {formatYen(m.unitPrice)} 円
                    </p>
                  </div>
                ))}
              </div>
              <label className="flex flex-col text-sm">
                <span className="mb-1 text-slate-500">
                  {hypoMonth}（仮単価）
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={hypoPrice}
                  onChange={(e) => setHypoPrice(e.target.value)}
                  placeholder="例: 1000000"
                  className="w-48 rounded-lg border border-slate-300 px-3 py-2"
                  min={0}
                />
              </label>
            </div>
          )
        ) : (
          <div className="flex flex-wrap gap-3">
            {all3Months.map((ym, i) => (
              <label key={ym} className="flex flex-col text-sm">
                <span className="mb-1 text-slate-500">{ym}（仮単価）</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={all3Prices[i]}
                  onChange={(e) =>
                    setAll3Prices((prev) => {
                      const next = [...prev] as [string, string, string];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                  placeholder="例: 1000000"
                  className="w-40 rounded-lg border border-slate-300 px-3 py-2"
                  min={0}
                />
              </label>
            ))}
          </div>
        )}
      </Card>

      {/* 試算結果と差分 */}
      {!simulation ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-400">
            仮単価を入力すると、帯・還元率・給与・計算式がリアルタイムに表示されます。
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {diff && <DiffCard diff={diff} baseline={baselineResult} sim={simulation.breakdown} />}
          <SalaryBreakdownCard title="試算結果" result={simulation} />
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-indigo-500 bg-indigo-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          active ? "text-indigo-700" : "text-slate-800"
        }`}
      >
        {title}
      </p>
      <p className="mt-1 text-xs text-slate-500">{desc}</p>
    </button>
  );
}

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
        <SectionTitle>現在の予測との差分</SectionTitle>
        <p className="text-sm text-slate-400">
          比較対象となる現在の予測がまだありません。直近3ヶ月の単価を入力すると差分を表示できます。
        </p>
      </Card>
    );
  }

  const b = diff.baseline;
  return (
    <Card className="ring-2 ring-indigo-100">
      <SectionTitle>現在の予測との差分</SectionTitle>

      {/* 給与差額 */}
      <div className="mb-4">
        {diff.salaryDelta === null ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-700">{CONSULT_DELTA_BLOCKED}</p>
            {(b.status === "consult" || sim.status === "consult") && (
              <StatusGuidance status="consult" compact />
            )}
          </div>
        ) : (
          <div>
            <p
              className={`text-3xl font-bold ${
                diff.salaryDelta > 0
                  ? "text-emerald-600"
                  : diff.salaryDelta < 0
                    ? "text-red-600"
                    : "text-slate-700"
              }`}
            >
              {diff.salaryDelta > 0 ? "+" : ""}
              {formatYen(diff.salaryDelta)}
              <span className="ml-1 text-base font-normal text-slate-500">
                円 / 月
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              現在の予測 {formatYen(b.salary ?? 0)} 円 → 試算{" "}
              {formatYen(sim.salary ?? 0)} 円
            </p>
          </div>
        )}
      </div>

      {/* 帯・ランクの変化 */}
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <dt className="text-slate-500">帯</dt>
          <dd className="flex items-center gap-2 font-medium text-slate-800">
            <span>{b.band.code}</span>
            {diff.bandChanged ? (
              <>
                <span className="text-slate-300">→</span>
                <Badge tone="indigo">{sim.band.code}</Badge>
              </>
            ) : (
              <span className="text-xs text-slate-400">（変化なし）</span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <dt className="text-slate-500">評価ランク</dt>
          <dd className="flex items-center gap-2 font-medium text-slate-800">
            <span>ランク {b.rank}</span>
            {diff.rankChanged ? (
              <>
                <span className="text-slate-300">→</span>
                <Badge tone="indigo">ランク {sim.rank}</Badge>
              </>
            ) : (
              <span className="text-xs text-slate-400">（変化なし）</span>
            )}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
