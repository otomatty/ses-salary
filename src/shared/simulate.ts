/**
 * 単価シミュレーション（試算）のための純関数（PRD §5.2 Should）。
 *
 * 仮の単価から「もしこの単価なら次の給与はいくらか」を試算する。
 * DB には一切書き込まず、calcSalary() を流用してクライアント側で完結する。
 */

import { calcSalary, type PricePoint, type SalaryBreakdown } from "./calc";
import { addMonths, compareYM, type SalaryResult } from "./periods";
import type { Rank } from "./rateTable";

/** 適用期間ラベル（例: "2026-04 〜 2026-06"） */
function periodLabel(appliedFrom: string): string {
  return `${appliedFrom} 〜 ${addMonths(appliedFrom, 2)}`;
}

/**
 * 直近実績の2ヶ月を「古い順」で返す。実績が2件に満たない場合は揃っている分だけ返す。
 * （「直近2ヶ月＋仮単価1ヶ月」モードで利用する）
 */
export function latestTwoMonths(prices: PricePoint[]): PricePoint[] {
  return [...prices]
    .sort((a, b) => compareYM(b.yearMonth, a.yearMonth))
    .slice(0, 2)
    .reverse();
}

/**
 * 対象3ヶ月の単価と評価ランクから試算結果（適用月付き）を組み立てる。
 * 適用月は対象3ヶ月の最新月の翌月。保存はしない。
 */
export function buildSimulation(
  months: PricePoint[],
  rank: Rank,
): SalaryResult {
  const sorted = [...months].sort((a, b) =>
    compareYM(a.yearMonth, b.yearMonth),
  );
  const latest = sorted[sorted.length - 1].yearMonth;
  const appliedFrom = addMonths(latest, 1);
  return {
    appliedFrom,
    periodLabel: periodLabel(appliedFrom),
    breakdown: calcSalary(sorted, rank),
  };
}

export interface SimulationDiff {
  /** 比較対象（現在の予測）。無い場合は null */
  baseline: SalaryBreakdown | null;
  /** 給与差額（円）。どちらかが要相談(null)なら null */
  salaryDelta: number | null;
  /** 帯コードが変化したか */
  bandChanged: boolean;
  /** 評価ランクが変化したか */
  rankChanged: boolean;
}

/**
 * 試算結果と現在の予測（baseline）の差分を求める。
 * 差額・帯の変化・ランクの変化を返す。
 */
export function diffSimulation(
  baseline: SalaryBreakdown | null,
  sim: SalaryBreakdown,
): SimulationDiff {
  if (!baseline) {
    return {
      baseline: null,
      salaryDelta: null,
      bandChanged: false,
      rankChanged: false,
    };
  }
  const salaryDelta =
    baseline.salary !== null && sim.salary !== null
      ? sim.salary - baseline.salary
      : null;
  return {
    baseline,
    salaryDelta,
    bandChanged: baseline.band.code !== sim.band.code,
    rankChanged: baseline.rank !== sim.rank,
  };
}
